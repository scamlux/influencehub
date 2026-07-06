// click-webhook — Click SHOPAPI endpoint (Prepare / Complete).
//
// Click's gateway calls this directly (verify_jwt = false); every request is
// authenticated by the md5 sign_string. merchant_trans_id encodes the order:
//   "sub:<user_id>:<plan>"  — subscription purchase
//   "deal:<deal_id>"        — escrow funding for a deal (T-14)
//
// Protocol logic lives in core.ts (unit-tested in core_test.ts); business
// effects live in ../_shared/fulfill.ts (shared with Payme).

import { crypto } from "jsr:@std/crypto@1";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";
import { fulfillOrder, parseOrderRef, validateOrder } from "../_shared/fulfill.ts";
import {
  ClickError,
  handleClickRequest,
  type ClickParams,
  type ClickStore,
  type ClickTx,
} from "./core.ts";

async function md5(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("MD5", new TextEncoder().encode(s));
  return encodeHex(digest);
}

type Admin = ReturnType<typeof adminClient>;

function rowToTx(row: Record<string, unknown>): ClickTx {
  return {
    click_trans_id: row.click_trans_id as string,
    merchant_trans_id: row.merchant_trans_id as string,
    merchant_prepare_id: Number(row.merchant_prepare_id),
    amount: Number(row.amount),
    status: row.status as ClickTx["status"],
  };
}

function supabaseStore(admin: Admin): ClickStore {
  return {
    async validateOrder(merchantTransId) {
      const order = parseOrderRef(merchantTransId);
      if (!order) {
        return { ok: false, error: ClickError.OrderNotFound, note: "Unknown order reference" };
      }
      const v = await validateOrder(admin, order);
      if (!v.ok) {
        return v.reason === "not_found"
          ? { ok: false, error: ClickError.OrderNotFound, note: "Order not found" }
          : { ok: false, error: ClickError.AlreadyPaid, note: "Order is not payable" };
      }
      return v;
    },

    async getByClickTransId(clickTransId) {
      const { data, error } = await admin
        .from("click_transactions")
        .select("*")
        .eq("click_trans_id", clickTransId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToTx(data) : null;
    },

    async insertPrepared(tx) {
      const order = parseOrderRef(tx.merchant_trans_id);
      const { data, error } = await admin
        .from("click_transactions")
        .insert({
          click_trans_id: tx.click_trans_id,
          merchant_trans_id: tx.merchant_trans_id,
          amount: tx.amountTiyin,
          action: 0,
          status: "prepared",
          user_id: order?.kind === "subscription" ? order.userId : null,
          plan_type: order?.kind === "subscription" ? order.plan : null,
          deal_id: order?.kind === "deal" ? order.dealId : null,
        })
        .select("merchant_prepare_id")
        .single();
      if (error) throw new Error(error.message);
      return Number(data.merchant_prepare_id);
    },

    async markCompleted(clickTransId) {
      const { error } = await admin
        .from("click_transactions")
        .update({ status: "completed", action: 1, completed_at: new Date().toISOString() })
        .eq("click_trans_id", clickTransId);
      if (error) throw new Error(error.message);
    },

    async markCancelled(clickTransId, errorCode) {
      const { error } = await admin
        .from("click_transactions")
        .update({ status: "cancelled", action: 1, error_code: errorCode })
        .eq("click_trans_id", clickTransId);
      if (error) throw new Error(error.message);
    },

    async fulfill(tx) {
      const order = parseOrderRef(tx.merchant_trans_id);
      if (!order) throw new Error("Unfulfillable merchant_trans_id");
      await fulfillOrder(admin, order, {
        provider: "click",
        providerRef: tx.click_trans_id,
        amount: Math.round(tx.amount / 100),
        currency: "UZS",
      });
    },
  };
}

async function parseParams(req: Request): Promise<ClickParams> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    return (await req.json()) as ClickParams;
  }
  // Click posts application/x-www-form-urlencoded.
  const form = await req.formData();
  return Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])) as ClickParams;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const secretKey = Deno.env.get("CLICK_SECRET_KEY") ?? "";
  const serviceId = Deno.env.get("CLICK_SERVICE_ID") ?? "";
  if (!secretKey || !serviceId) {
    return json({ error: -8, error_note: "Click is not configured" }, 200);
  }

  try {
    const params = await parseParams(req);
    const response = await handleClickRequest(
      params,
      { secretKey, serviceId },
      md5,
      supabaseStore(adminClient()),
    );
    return json(response, 200);
  } catch (e) {
    console.error("click-webhook failure:", e);
    return json({ error: -8, error_note: "Internal error" }, 200);
  }
});
