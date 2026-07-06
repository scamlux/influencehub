// payme-webhook — Payme Merchant API endpoint (JSON-RPC 2.0).
//
// Payme's gateway calls this function directly (verify_jwt = false in
// config.toml); every request is authenticated with Basic Paycom:<merchant
// key> instead. Sandbox mode: set PAYME_MERCHANT_TEST_KEY and point the
// sandbox cabinet (test.paycom.uz) at this URL — both keys are accepted, so
// test and prod cabinets can coexist.
//
// Supported accounts:
//   { user_id, plan }  — subscription purchase (amount = plan price in tiyin)
//   { deal_id }        — escrow funding for a deal (T-14)
//
// Protocol logic lives in core.ts (unit-tested in core_test.ts); business
// effects live in ../_shared/fulfill.ts (shared with Click).

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";
import { fulfillOrder, revertOrder, validateOrder, type OrderRef } from "../_shared/fulfill.ts";
import { PLANS_USD, type PlanType } from "../_shared/uz.ts";
import { clientIp, rateLimit } from "../_shared/rate-limit.ts";
import {
  handlePaymeRpc,
  isAuthorized,
  PaymeError,
  type PaymeAccount,
  type PaymeStore,
  type PaymeTx,
} from "./core.ts";

type Admin = ReturnType<typeof adminClient>;

function accountToOrder(account: PaymeAccount): OrderRef | null {
  if (account.deal_id) return { kind: "deal", dealId: account.deal_id };
  if (account.user_id && account.plan && account.plan in PLANS_USD) {
    return { kind: "subscription", userId: account.user_id, plan: account.plan as PlanType };
  }
  return null;
}

function rowToTx(row: Record<string, unknown>): PaymeTx {
  return {
    paycom_transaction_id: row.paycom_transaction_id as string,
    paycom_time: Number(row.paycom_time),
    amount: Number(row.amount),
    account: (row.account ?? {}) as PaymeAccount,
    state: Number(row.state),
    reason: (row.reason as number | null) ?? null,
    create_time: Number(row.create_time),
    perform_time: Number(row.perform_time ?? 0),
    cancel_time: Number(row.cancel_time ?? 0),
  };
}

function supabaseStore(admin: Admin): PaymeStore {
  return {
    now: () => Date.now(),

    async getTransaction(paycomId) {
      const { data, error } = await admin
        .from("payme_transactions")
        .select("*")
        .eq("paycom_transaction_id", paycomId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? rowToTx(data) : null;
    },

    async findPendingForAccount(account, excludePaycomId) {
      const { data, error } = await admin
        .from("payme_transactions")
        .select("*")
        .eq("state", 1)
        .neq("paycom_transaction_id", excludePaycomId)
        .contains(
          "account",
          account.deal_id
            ? { deal_id: account.deal_id }
            : { user_id: account.user_id, plan: account.plan },
        );
      if (error) throw new Error(error.message);
      return data?.length ? rowToTx(data[0]) : null;
    },

    async insertTransaction(tx) {
      const { error } = await admin.from("payme_transactions").insert({
        paycom_transaction_id: tx.paycom_transaction_id,
        paycom_time: tx.paycom_time,
        amount: tx.amount,
        account: tx.account,
        state: tx.state,
        create_time: tx.create_time,
        user_id: tx.account.user_id ?? null,
        plan_type: tx.account.plan ?? null,
        deal_id: tx.account.deal_id ?? null,
      });
      if (error) throw new Error(error.message);
    },

    async updateTransaction(paycomId, patch) {
      const { error } = await admin
        .from("payme_transactions")
        .update(patch)
        .eq("paycom_transaction_id", paycomId);
      if (error) throw new Error(error.message);
    },

    async validateAccount(account) {
      const order = accountToOrder(account);
      if (!order) {
        return { ok: false, code: PaymeError.AccountNotFound, message: "Unknown account" };
      }
      const v = await validateOrder(admin, order);
      if (!v.ok) {
        return {
          ok: false,
          code: PaymeError.AccountNotFound,
          message: v.reason === "not_found" ? "Order not found" : "Order is not payable",
        };
      }
      return v;
    },

    async onPerform(tx) {
      const order = accountToOrder(tx.account);
      if (!order) throw new Error("Unfulfillable account on perform");
      await fulfillOrder(admin, order, {
        provider: "payme",
        providerRef: tx.paycom_transaction_id,
        amount: Math.round(tx.amount / 100),
        currency: "UZS",
      });
    },

    async onCancelAfterPerform(tx) {
      const order = accountToOrder(tx.account);
      if (!order) return;
      await revertOrder(admin, order, {
        provider: "payme",
        providerRef: tx.paycom_transaction_id,
        amount: Math.round(tx.amount / 100),
        currency: "UZS",
      });
    },
  };
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  // Payme retries aggressively; a generous window absorbs legitimate retries
  // while still capping abuse. Over-limit returns a protocol error (HTTP 200).
  const rl = rateLimit(`payme:${clientIp(req)}`, { limit: 120, windowSec: 60 });
  if (!rl.allowed) {
    return json({ id: null, error: { code: -32400, message: "Too many requests" } }, 200);
  }

  const keys = [
    Deno.env.get("PAYME_MERCHANT_KEY") ?? "",
    Deno.env.get("PAYME_MERCHANT_TEST_KEY") ?? "",
  ].filter(Boolean);
  const authorized = keys.length > 0 && isAuthorized(req.headers.get("Authorization"), keys);

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    return json({ id: null, error: { code: PaymeError.ParseError, message: "Parse error" } }, 200);
  }

  try {
    const response = await handlePaymeRpc(body, supabaseStore(adminClient()), authorized);
    // Payme expects HTTP 200 even for protocol errors.
    return json({ jsonrpc: "2.0", ...response }, 200);
  } catch (e) {
    console.error("payme-webhook failure:", e);
    return json({ id: null, error: { code: -32400, message: "Internal error" } }, 200);
  }
});
