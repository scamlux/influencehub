// payme-webhook
// Implements the Payme (Paycom) Merchant API — the stateful JSON-RPC endpoint Payme
// calls to drive a payment's lifecycle. Register with verify_jwt = false (Payme sends
// HTTP Basic auth, not a Supabase JWT).
//
// Secrets:
//   PAYME_KEY  — the Merchant API key ("password" for the endpoint). Payme authenticates
//                as  Authorization: Basic base64("Paycom:" + PAYME_KEY).
//
// Endpoint to register in the Payme merchant cabinet:
//   https://<project-ref>.functions.supabase.co/payme-webhook
//   Account field: order_id  (maps to a pending public.payments row)
//
// Flow: process-subscription creates a pending payments row (provider='payme', amount in
// UZS) and redirects the user to Payme checkout with ac.order_id = <payment.id>. Payme
// then calls the methods below; PerformTransaction is what actually grants the plan.
//
// Reference: https://developer.help.paycom.uz/metody-merchant-api/

import { adminClient } from "../_shared/client.ts";

// ── Payme protocol constants ──────────────────────────────────────────────────
const STATE_CREATED = 1;
const STATE_PERFORMED = 2;
const STATE_CANCELLED = -1; // cancelled while only created
const STATE_CANCELLED_AFTER = -2; // cancelled after being performed
const TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12h: a created-but-unperformed tx expires

// JSON-RPC / Payme error codes
const ERR_AUTH = -32504;
const ERR_METHOD = -32601;
const ERR_PARSE = -32700;
const ERR_INVALID_AMOUNT = -31001;
const ERR_ORDER_NOT_FOUND = -31050; // account/order errors live in -31050..-31099
const ERR_ORDER_HAS_TX = -31099;
const ERR_TX_NOT_FOUND = -31003;
const ERR_CANNOT_PERFORM = -31008;
const ERR_CANNOT_CANCEL = -31007;

type L = { ru: string; uz: string; en: string };
const msg = (en: string, ru = en, uz = en): L => ({ ru, uz, en });

class PaymeError extends Error {
  constructor(
    public code: number,
    public payload: L,
    public data?: string,
  ) {
    super(payload.en);
  }
}

function rpc(id: unknown, result: unknown) {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    headers: { "Content-Type": "application/json" },
  });
}
function rpcError(id: unknown, code: number, message: L, data?: string) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message, data } }),
    { headers: { "Content-Type": "application/json" } },
  );
}

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

// ── Auth: Payme sends Basic  "Paycom:<key>" ───────────────────────────────────
function authorized(req: Request): boolean {
  const key = Deno.env.get("PAYME_KEY") ?? "";
  const header = req.headers.get("Authorization") ?? "";
  if (!key || !header.startsWith("Basic ")) return false;
  try {
    const decoded = atob(header.slice(6)); // "Paycom:<key>"
    const idx = decoded.indexOf(":");
    return idx >= 0 && decoded.slice(idx + 1) === key;
  } catch {
    return false;
  }
}

// ── Account → pending payment (order) ─────────────────────────────────────────
async function loadOrder(admin: ReturnType<typeof adminClient>, account: Record<string, string>) {
  const orderId = account?.order_id;
  if (!orderId) {
    throw new PaymeError(ERR_ORDER_NOT_FOUND, msg("Order not found"), "order_id");
  }
  const { data } = await admin
    .from("payments")
    .select("id, user_id, plan_type, amount, status, provider")
    .eq("id", orderId)
    .eq("provider", "payme")
    .maybeSingle();
  if (!data) {
    throw new PaymeError(ERR_ORDER_NOT_FOUND, msg("Order not found"), "order_id");
  }
  return data as {
    id: string;
    user_id: string;
    plan_type: string;
    amount: number;
    status: string;
    provider: string;
  };
}

// Payme amount is in tiyin; payments.amount is UZS.
const toTiyin = (uzs: number) => Math.round(uzs * 100);

// ── Method handlers ───────────────────────────────────────────────────────────
async function checkPerform(admin: ReturnType<typeof adminClient>, params: any) {
  const order = await loadOrder(admin, params.account);
  if (Number(params.amount) !== toTiyin(order.amount)) {
    throw new PaymeError(ERR_INVALID_AMOUNT, msg("Invalid amount"));
  }
  if (order.status === "succeeded") {
    throw new PaymeError(ERR_ORDER_HAS_TX, msg("Order already paid"), "order_id");
  }
  return { allow: true };
}

async function createTransaction(admin: ReturnType<typeof adminClient>, params: any) {
  const { data: existing } = await admin
    .from("payme_transactions")
    .select("*")
    .eq("paycom_id", params.id)
    .maybeSingle();

  if (existing) {
    if (existing.state !== STATE_CREATED) {
      throw new PaymeError(ERR_CANNOT_PERFORM, msg("Transaction is not creatable"));
    }
    if (Date.now() - existing.create_time > TIMEOUT_MS) {
      await admin
        .from("payme_transactions")
        .update({ state: STATE_CANCELLED, reason: 4, cancel_time: Date.now() })
        .eq("id", existing.id);
      throw new PaymeError(ERR_CANNOT_PERFORM, msg("Transaction timed out"));
    }
    return {
      create_time: existing.create_time,
      transaction: existing.id,
      state: existing.state,
    };
  }

  // New transaction: validate order + amount, and reject if the order already has one.
  const order = await loadOrder(admin, params.account);
  if (Number(params.amount) !== toTiyin(order.amount)) {
    throw new PaymeError(ERR_INVALID_AMOUNT, msg("Invalid amount"));
  }
  if (order.status === "succeeded") {
    throw new PaymeError(ERR_ORDER_HAS_TX, msg("Order already paid"), "order_id");
  }
  const { data: other } = await admin
    .from("payme_transactions")
    .select("id, state")
    .eq("order_id", order.id)
    .in("state", [STATE_CREATED, STATE_PERFORMED])
    .maybeSingle();
  if (other) {
    throw new PaymeError(ERR_ORDER_HAS_TX, msg("Order already has a transaction"), "order_id");
  }

  const now = Date.now();
  const { data: created, error } = await admin
    .from("payme_transactions")
    .insert({
      paycom_id: params.id,
      order_id: order.id,
      amount: Number(params.amount),
      state: STATE_CREATED,
      create_time: now,
    })
    .select("id")
    .single();
  if (error) throw new PaymeError(ERR_CANNOT_PERFORM, msg(error.message));

  return { create_time: now, transaction: created.id, state: STATE_CREATED };
}

async function performTransaction(admin: ReturnType<typeof adminClient>, params: any) {
  const { data: tx } = await admin
    .from("payme_transactions")
    .select("*")
    .eq("paycom_id", params.id)
    .maybeSingle();
  if (!tx) throw new PaymeError(ERR_TX_NOT_FOUND, msg("Transaction not found"));

  if (tx.state === STATE_PERFORMED) {
    return { transaction: tx.id, perform_time: tx.perform_time, state: STATE_PERFORMED };
  }
  if (tx.state !== STATE_CREATED) {
    throw new PaymeError(ERR_CANNOT_PERFORM, msg("Transaction cannot be performed"));
  }
  if (Date.now() - tx.create_time > TIMEOUT_MS) {
    await admin
      .from("payme_transactions")
      .update({ state: STATE_CANCELLED, reason: 4, cancel_time: Date.now() })
      .eq("id", tx.id);
    throw new PaymeError(ERR_CANNOT_PERFORM, msg("Transaction timed out"));
  }

  const now = Date.now();
  // Grant the plan: mark the order paid and activate the subscription (idempotent-ish;
  // a repeated Perform returns early above once state is 2).
  const { data: order } = await admin
    .from("payments")
    .select("user_id, plan_type")
    .eq("id", tx.order_id)
    .single();
  if (order?.user_id && order.plan_type) {
    await admin.from("subscriptions").insert({
      user_id: order.user_id,
      plan_type: order.plan_type,
      status: "active",
      expires_at: expiryFor(order.plan_type),
    });
  }
  await admin.from("payments").update({ status: "succeeded" }).eq("id", tx.order_id);
  await admin
    .from("payme_transactions")
    .update({ state: STATE_PERFORMED, perform_time: now })
    .eq("id", tx.id);

  return { transaction: tx.id, perform_time: now, state: STATE_PERFORMED };
}

async function cancelTransaction(admin: ReturnType<typeof adminClient>, params: any) {
  const { data: tx } = await admin
    .from("payme_transactions")
    .select("*")
    .eq("paycom_id", params.id)
    .maybeSingle();
  if (!tx) throw new PaymeError(ERR_TX_NOT_FOUND, msg("Transaction not found"));

  // Idempotent: already cancelled → return stored cancel state.
  if (tx.state === STATE_CANCELLED || tx.state === STATE_CANCELLED_AFTER) {
    return { transaction: tx.id, cancel_time: tx.cancel_time, state: tx.state };
  }

  const now = Date.now();
  const newState = tx.state === STATE_PERFORMED ? STATE_CANCELLED_AFTER : STATE_CANCELLED;

  // Reverse side effects: mark payment cancelled and revoke a granted subscription.
  await admin.from("payments").update({ status: "cancelled" }).eq("id", tx.order_id);
  if (tx.state === STATE_PERFORMED) {
    const { data: order } = await admin
      .from("payments")
      .select("user_id, plan_type")
      .eq("id", tx.order_id)
      .single();
    if (order?.user_id && order.plan_type) {
      await admin
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("user_id", order.user_id)
        .eq("plan_type", order.plan_type)
        .eq("status", "active");
    }
  }

  await admin
    .from("payme_transactions")
    .update({ state: newState, reason: params.reason ?? null, cancel_time: now })
    .eq("id", tx.id);

  return { transaction: tx.id, cancel_time: now, state: newState };
}

async function checkTransaction(admin: ReturnType<typeof adminClient>, params: any) {
  const { data: tx } = await admin
    .from("payme_transactions")
    .select("*")
    .eq("paycom_id", params.id)
    .maybeSingle();
  if (!tx) throw new PaymeError(ERR_TX_NOT_FOUND, msg("Transaction not found"));
  return {
    create_time: tx.create_time,
    perform_time: tx.perform_time,
    cancel_time: tx.cancel_time,
    transaction: tx.id,
    state: tx.state,
    reason: tx.reason ?? null,
  };
}

async function getStatement(admin: ReturnType<typeof adminClient>, params: any) {
  const { data } = await admin
    .from("payme_transactions")
    .select("*")
    .gte("create_time", Number(params.from))
    .lte("create_time", Number(params.to));
  return {
    transactions: (data ?? []).map((tx) => ({
      id: tx.paycom_id,
      time: tx.create_time,
      amount: tx.amount,
      account: { order_id: tx.order_id },
      create_time: tx.create_time,
      perform_time: tx.perform_time,
      cancel_time: tx.cancel_time,
      transaction: tx.id,
      state: tx.state,
      reason: tx.reason ?? null,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, ERR_PARSE, msg("Parse error"));
  }
  const { id, method, params } = body ?? {};

  // Payme authenticates every request via HTTP Basic.
  if (!authorized(req)) {
    return rpcError(id, ERR_AUTH, msg("Insufficient privileges"));
  }

  const admin = adminClient();
  try {
    switch (method) {
      case "CheckPerformTransaction":
        return rpc(id, await checkPerform(admin, params));
      case "CreateTransaction":
        return rpc(id, await createTransaction(admin, params));
      case "PerformTransaction":
        return rpc(id, await performTransaction(admin, params));
      case "CancelTransaction":
        return rpc(id, await cancelTransaction(admin, params));
      case "CheckTransaction":
        return rpc(id, await checkTransaction(admin, params));
      case "GetStatement":
        return rpc(id, await getStatement(admin, params));
      default:
        return rpcError(id, ERR_METHOD, msg("Method not found"));
    }
  } catch (e) {
    if (e instanceof PaymeError) return rpcError(id, e.code, e.payload, e.data);
    return rpcError(id, ERR_CANNOT_PERFORM, msg(String(e)));
  }
});
