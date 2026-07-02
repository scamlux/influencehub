// click-webhook
// Implements the Click (Click.uz) SHOP API two-step callback: Prepare (action=0) and
// Complete (action=1). Register with verify_jwt = false (Click sends an MD5 signature,
// not a Supabase JWT). Requests are application/x-www-form-urlencoded.
//
// Secrets:
//   CLICK_SERVICE_ID  — merchant service id (echoed/validated)
//   CLICK_SECRET_KEY  — used in the MD5 sign_string
//
// Flow: process-subscription creates a pending payments row (provider='click') and
// redirects the user to Click with merchant_trans_id = <payment.id>. Click then calls
// Prepare, then Complete; Complete with error=0 grants the plan.
//
// Reference: https://docs.click.uz/en/click-api/

import { createHash } from "node:crypto";
import { adminClient } from "../_shared/client.ts";

// Click error codes
const OK = 0;
const ERR_SIGN = -1;
const ERR_AMOUNT = -2;
const ERR_ACTION = -3;
const ERR_ALREADY_PAID = -4;
const ERR_ORDER_NOT_FOUND = -5;
const ERR_TX_NOT_FOUND = -6;
const ERR_CANCELLED = -9;

const PLAN_CADENCE: Record<string, "month" | "day"> = {
  brand_pro: "month",
  influencer_sync: "month",
  influencer_feature: "day",
};
function expiryFor(plan: string): string {
  const d = new Date();
  if (PLAN_CADENCE[plan] === "day") d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

function reply(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const secret = Deno.env.get("CLICK_SECRET_KEY") ?? "";
  const form = new URLSearchParams(await req.text());
  const p = (k: string) => form.get(k) ?? "";

  const click_trans_id = p("click_trans_id");
  const service_id = p("service_id");
  const merchant_trans_id = p("merchant_trans_id"); // = payments.id
  const merchant_prepare_id = p("merchant_prepare_id");
  const amount = p("amount");
  const action = p("action");
  const sign_time = p("sign_time");
  const sign_string = p("sign_string");

  const base = {
    click_trans_id,
    merchant_trans_id,
  };

  // Signature check. Prepare and Complete hash different field orders.
  const expected =
    action === "1"
      ? md5(
          click_trans_id +
            service_id +
            secret +
            merchant_trans_id +
            merchant_prepare_id +
            amount +
            action +
            sign_time,
        )
      : md5(
          click_trans_id + service_id + secret + merchant_trans_id + amount + action + sign_time,
        );
  if (!secret || sign_string !== expected) {
    return reply({ ...base, error: ERR_SIGN, error_note: "Invalid sign" });
  }

  const admin = adminClient();

  // Load the order (pending Click payment).
  const { data: order } = await admin
    .from("payments")
    .select("id, user_id, plan_type, amount, status, provider")
    .eq("id", merchant_trans_id)
    .eq("provider", "click")
    .maybeSingle();
  if (!order) {
    return reply({ ...base, error: ERR_ORDER_NOT_FOUND, error_note: "Order not found" });
  }
  if (Math.round(Number(amount)) !== Math.round(Number(order.amount))) {
    return reply({ ...base, error: ERR_AMOUNT, error_note: "Incorrect amount" });
  }
  if (order.status === "succeeded") {
    return reply({ ...base, error: ERR_ALREADY_PAID, error_note: "Already paid" });
  }

  // ── Prepare (action=0) ────────────────────────────────────────────────────
  if (action === "0") {
    const { data: tx, error } = await admin
      .from("click_transactions")
      .upsert(
        {
          click_trans_id,
          order_id: order.id,
          amount: Number(amount),
          state: 0,
        },
        { onConflict: "click_trans_id,order_id" },
      )
      .select("id")
      .single();
    if (error) return reply({ ...base, error: ERR_TX_NOT_FOUND, error_note: error.message });

    // Use a stable numeric prepare id derived from the row; persist it.
    const prepareId = Date.now();
    await admin.from("click_transactions").update({ prepare_id: prepareId }).eq("id", tx.id);
    return reply({ ...base, merchant_prepare_id: prepareId, error: OK, error_note: "Success" });
  }

  // ── Complete (action=1) ───────────────────────────────────────────────────
  if (action === "1") {
    const { data: tx } = await admin
      .from("click_transactions")
      .select("*")
      .eq("click_trans_id", click_trans_id)
      .eq("order_id", order.id)
      .maybeSingle();
    if (!tx || String(tx.prepare_id) !== merchant_prepare_id) {
      return reply({ ...base, error: ERR_TX_NOT_FOUND, error_note: "Transaction not found" });
    }
    if (tx.state === -1) {
      return reply({ ...base, error: ERR_CANCELLED, error_note: "Transaction cancelled" });
    }

    // Click sends its own `error` param; a negative value means the payment failed.
    const clickError = Number(p("error") || "0");
    if (clickError < 0) {
      await admin.from("click_transactions").update({ state: -1 }).eq("id", tx.id);
      await admin.from("payments").update({ status: "cancelled" }).eq("id", order.id);
      return reply({ ...base, error: ERR_CANCELLED, error_note: "Payment cancelled" });
    }

    // Grant the plan.
    await admin.from("subscriptions").insert({
      user_id: order.user_id,
      plan_type: order.plan_type,
      status: "active",
      expires_at: expiryFor(order.plan_type),
    });
    await admin.from("payments").update({ status: "succeeded" }).eq("id", order.id);
    await admin.from("click_transactions").update({ state: 1 }).eq("id", tx.id);

    return reply({ ...base, merchant_confirm_id: tx.prepare_id, error: OK, error_note: "Success" });
  }

  return reply({ ...base, error: ERR_ACTION, error_note: "Unknown action" });
});
