// Integration tests for the Payme Merchant API protocol core (T-05).
// Run: deno test backend/supabase/functions/payme-webhook/core_test.ts

import { assertEquals } from "jsr:@std/assert@1";
import {
  handlePaymeRpc,
  isAuthorized,
  PaymeError,
  TxState,
  type PaymeAccount,
  type PaymeStore,
  type PaymeTx,
} from "./core.ts";

const PLAN_TIYIN = 29 * 12800 * 100; // brand_pro at the default rate

function memoryStore() {
  const txs = new Map<string, PaymeTx>();
  const effects = { performed: 0, reverted: 0 };
  let clock = 1_700_000_000_000;

  const store: PaymeStore = {
    now: () => ++clock,
    getTransaction: (id) =>
      Promise.resolve(txs.get(id) ? { ...txs.get(id)! } : null),
    findPendingForAccount: (account, exclude) => {
      for (const tx of txs.values()) {
        if (
          tx.paycom_transaction_id === exclude ||
          tx.state !== TxState.Created
        )
          continue;
        const same = account.deal_id
          ? tx.account.deal_id === account.deal_id
          : tx.account.user_id === account.user_id &&
            tx.account.plan === account.plan;
        if (same) return Promise.resolve({ ...tx });
      }
      return Promise.resolve(null);
    },
    insertTransaction: (tx) => {
      txs.set(tx.paycom_transaction_id, { ...tx });
      return Promise.resolve();
    },
    updateTransaction: (id, patch) => {
      txs.set(id, { ...txs.get(id)!, ...patch });
      return Promise.resolve();
    },
    validateAccount: (account: PaymeAccount) => {
      if (account.user_id === "user-1" && account.plan === "brand_pro") {
        return Promise.resolve({
          ok: true as const,
          expectedTiyin: PLAN_TIYIN,
        });
      }
      return Promise.resolve({
        ok: false as const,
        code: PaymeError.AccountNotFound,
        message: "Unknown account",
      });
    },
    onPerform: () => {
      effects.performed += 1;
      return Promise.resolve();
    },
    onCancelAfterPerform: () => {
      effects.reverted += 1;
      return Promise.resolve();
    },
  };
  return { store, effects, txs };
}

const account = { user_id: "user-1", plan: "brand_pro" };
const rpc = (method: string, params: Record<string, unknown>, id = 1) => ({
  id,
  method,
  params,
});

Deno.test("rejects unauthorized requests with -32504", async () => {
  const { store } = memoryStore();
  const res = await handlePaymeRpc(
    rpc("CheckPerformTransaction", { amount: 1, account }),
    store,
    false,
  );
  assertEquals(res.error?.code, PaymeError.InvalidAuthorization);
});

Deno.test("isAuthorized verifies Basic Paycom:<key>", () => {
  const good = "Basic " + btoa("Paycom:secret");
  assertEquals(isAuthorized(good, ["secret"]), true);
  assertEquals(isAuthorized(good, ["other"]), false);
  assertEquals(
    isAuthorized("Basic " + btoa("Hacker:secret"), ["secret"]),
    false,
  );
  assertEquals(isAuthorized(null, ["secret"]), false);
  assertEquals(isAuthorized("Bearer abc", ["secret"]), false);
});

Deno.test(
  "CheckPerformTransaction: allow / bad amount / bad account",
  async () => {
    const { store } = memoryStore();
    const okRes = await handlePaymeRpc(
      rpc("CheckPerformTransaction", { amount: PLAN_TIYIN, account }),
      store,
      true,
    );
    assertEquals(okRes.result, { allow: true });

    const badAmount = await handlePaymeRpc(
      rpc("CheckPerformTransaction", { amount: PLAN_TIYIN - 1, account }),
      store,
      true,
    );
    assertEquals(badAmount.error?.code, PaymeError.InvalidAmount);

    const badAccount = await handlePaymeRpc(
      rpc("CheckPerformTransaction", {
        amount: PLAN_TIYIN,
        account: { user_id: "nope", plan: "brand_pro" },
      }),
      store,
      true,
    );
    assertEquals(badAccount.error?.code, PaymeError.AccountNotFound);
  },
);

Deno.test(
  "CreateTransaction: creates, retries idempotently, blocks second pending tx",
  async () => {
    const { store } = memoryStore();
    const params = { id: "tx-1", time: 111, amount: PLAN_TIYIN, account };

    const first = await handlePaymeRpc(
      rpc("CreateTransaction", params),
      store,
      true,
    );
    assertEquals(first.result?.state, TxState.Created);
    assertEquals(first.result?.transaction, "tx-1");

    const retry = await handlePaymeRpc(
      rpc("CreateTransaction", params),
      store,
      true,
    );
    assertEquals(retry.result?.create_time, first.result?.create_time);

    const second = await handlePaymeRpc(
      rpc("CreateTransaction", { ...params, id: "tx-2" }),
      store,
      true,
    );
    assertEquals(second.error?.code, PaymeError.AccountBusy);
  },
);

Deno.test(
  "PerformTransaction: performs once, repeat is idempotent, unknown → -31003",
  async () => {
    const { store, effects } = memoryStore();
    await handlePaymeRpc(
      rpc("CreateTransaction", { id: "tx-1", amount: PLAN_TIYIN, account }),
      store,
      true,
    );

    const performed = await handlePaymeRpc(
      rpc("PerformTransaction", { id: "tx-1" }),
      store,
      true,
    );
    assertEquals(performed.result?.state, TxState.Performed);
    assertEquals(effects.performed, 1);

    const repeat = await handlePaymeRpc(
      rpc("PerformTransaction", { id: "tx-1" }),
      store,
      true,
    );
    assertEquals(repeat.result?.perform_time, performed.result?.perform_time);
    assertEquals(effects.performed, 1); // business effect applied exactly once

    const missing = await handlePaymeRpc(
      rpc("PerformTransaction", { id: "nope" }),
      store,
      true,
    );
    assertEquals(missing.error?.code, PaymeError.TransactionNotFound);
  },
);

Deno.test(
  "CancelTransaction: before perform → -1, after perform → -2 with revert",
  async () => {
    const { store, effects } = memoryStore();

    await handlePaymeRpc(
      rpc("CreateTransaction", { id: "tx-1", amount: PLAN_TIYIN, account }),
      store,
      true,
    );
    const cancelled = await handlePaymeRpc(
      rpc("CancelTransaction", { id: "tx-1", reason: 3 }),
      store,
      true,
    );
    assertEquals(cancelled.result?.state, TxState.Cancelled);
    assertEquals(effects.reverted, 0);

    await handlePaymeRpc(
      rpc("CreateTransaction", { id: "tx-2", amount: PLAN_TIYIN, account }),
      store,
      true,
    );
    await handlePaymeRpc(
      rpc("PerformTransaction", { id: "tx-2" }),
      store,
      true,
    );
    const refunded = await handlePaymeRpc(
      rpc("CancelTransaction", { id: "tx-2", reason: 5 }),
      store,
      true,
    );
    assertEquals(refunded.result?.state, TxState.CancelledAfterPerform);
    assertEquals(effects.reverted, 1);

    // Idempotent repeat keeps state and doesn't revert twice.
    const repeat = await handlePaymeRpc(
      rpc("CancelTransaction", { id: "tx-2", reason: 5 }),
      store,
      true,
    );
    assertEquals(repeat.result?.state, TxState.CancelledAfterPerform);
    assertEquals(effects.reverted, 1);

    // A cancelled transaction cannot be performed.
    const performCancelled = await handlePaymeRpc(
      rpc("PerformTransaction", { id: "tx-1" }),
      store,
      true,
    );
    assertEquals(performCancelled.error?.code, PaymeError.CannotPerform);

    // CreateTransaction retry for a finalized id → -31008.
    const recreate = await handlePaymeRpc(
      rpc("CreateTransaction", { id: "tx-1", amount: PLAN_TIYIN, account }),
      store,
      true,
    );
    assertEquals(recreate.error?.code, PaymeError.CannotPerform);
  },
);

Deno.test("CheckTransaction returns the full stored state", async () => {
  const { store } = memoryStore();
  await handlePaymeRpc(
    rpc("CreateTransaction", { id: "tx-1", amount: PLAN_TIYIN, account }),
    store,
    true,
  );
  await handlePaymeRpc(rpc("PerformTransaction", { id: "tx-1" }), store, true);

  const res = await handlePaymeRpc(
    rpc("CheckTransaction", { id: "tx-1" }),
    store,
    true,
  );
  assertEquals(res.result?.transaction, "tx-1");
  assertEquals(res.result?.state, TxState.Performed);
  assertEquals(typeof res.result?.create_time, "number");
  assertEquals(typeof res.result?.perform_time, "number");
  assertEquals(res.result?.cancel_time, 0);

  const missing = await handlePaymeRpc(
    rpc("CheckTransaction", { id: "ghost" }),
    store,
    true,
  );
  assertEquals(missing.error?.code, PaymeError.TransactionNotFound);
});

Deno.test("unknown method → -32601", async () => {
  const { store } = memoryStore();
  const res = await handlePaymeRpc(rpc("GetStatement", {}), store, true);
  assertEquals(res.error?.code, PaymeError.MethodNotFound);
});
