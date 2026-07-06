// Integration tests for the Click SHOPAPI protocol core (T-06).
// Run: deno test backend/supabase/functions/click-webhook/core_test.ts

import { assertEquals } from "jsr:@std/assert@1";
import { crypto } from "jsr:@std/crypto@1";
import { encodeHex } from "jsr:@std/encoding@1/hex";
import {
  clickAmountToTiyin,
  ClickError,
  handleClickRequest,
  type ClickParams,
  type ClickStore,
  type ClickTx,
} from "./core.ts";

const CFG = { secretKey: "click-secret", serviceId: "12345" };
const ORDER = "sub:user-1:brand_pro";
const AMOUNT_UZS = "371200.00"; // 29 USD * 12800
const AMOUNT_TIYIN = clickAmountToTiyin(AMOUNT_UZS);

async function md5(s: string): Promise<string> {
  return encodeHex(
    await crypto.subtle.digest("MD5", new TextEncoder().encode(s)),
  );
}

function memoryStore() {
  const txs = new Map<string, ClickTx>();
  const effects = { fulfilled: 0 };
  let nextPrepareId = 100;

  const store: ClickStore = {
    validateOrder: (id) =>
      Promise.resolve(
        id === ORDER
          ? { ok: true as const, expectedTiyin: AMOUNT_TIYIN }
          : {
              ok: false as const,
              error: ClickError.OrderNotFound,
              note: "Order not found",
            },
      ),
    getByClickTransId: (id) =>
      Promise.resolve(txs.get(id) ? { ...txs.get(id)! } : null),
    insertPrepared: (tx) => {
      const merchant_prepare_id = nextPrepareId++;
      txs.set(tx.click_trans_id, {
        click_trans_id: tx.click_trans_id,
        merchant_trans_id: tx.merchant_trans_id,
        merchant_prepare_id,
        amount: tx.amountTiyin,
        status: "prepared",
      });
      return Promise.resolve(merchant_prepare_id);
    },
    markCompleted: (id) => {
      txs.get(id)!.status = "completed";
      return Promise.resolve();
    },
    markCancelled: (id) => {
      txs.get(id)!.status = "cancelled";
      return Promise.resolve();
    },
    fulfill: () => {
      effects.fulfilled += 1;
      return Promise.resolve();
    },
  };
  return { store, effects, txs };
}

async function signed(p: Partial<ClickParams>): Promise<ClickParams> {
  const base: ClickParams = {
    click_trans_id: "ct-1",
    service_id: CFG.serviceId,
    click_paydoc_id: "pd-1",
    merchant_trans_id: ORDER,
    amount: AMOUNT_UZS,
    action: "0",
    error: "0",
    sign_time: "2026-07-05 12:00:00",
    ...p,
  };
  const s =
    base.action === "1"
      ? `${base.click_trans_id}${base.service_id}${CFG.secretKey}${base.merchant_trans_id}${base.merchant_prepare_id}${base.amount}${base.action}${base.sign_time}`
      : `${base.click_trans_id}${base.service_id}${CFG.secretKey}${base.merchant_trans_id}${base.amount}${base.action}${base.sign_time}`;
  return { ...base, sign_string: await md5(s) };
}

Deno.test("rejects a bad signature / wrong service id", async () => {
  const { store } = memoryStore();
  const p = await signed({});
  const bad = await handleClickRequest(
    { ...p, sign_string: "deadbeef" },
    CFG,
    md5,
    store,
  );
  assertEquals(bad.error, ClickError.SignFailed);

  const wrongService = await signed({ service_id: "999" });
  const res = await handleClickRequest(wrongService, CFG, md5, store);
  assertEquals(res.error, ClickError.SignFailed);
});

Deno.test(
  "prepare: success, unknown order, wrong amount, idempotent retry",
  async () => {
    const { store } = memoryStore();

    const ok = await handleClickRequest(await signed({}), CFG, md5, store);
    assertEquals(ok.error, ClickError.Success);
    const prepareId = ok.merchant_prepare_id!;

    const retry = await handleClickRequest(await signed({}), CFG, md5, store);
    assertEquals(retry.error, ClickError.Success);
    assertEquals(retry.merchant_prepare_id, prepareId);

    const unknown = await handleClickRequest(
      await signed({
        click_trans_id: "ct-2",
        merchant_trans_id: "sub:ghost:brand_pro",
      }),
      CFG,
      md5,
      store,
    );
    assertEquals(unknown.error, ClickError.OrderNotFound);

    const badAmount = await handleClickRequest(
      await signed({ click_trans_id: "ct-3", amount: "1.00" }),
      CFG,
      md5,
      store,
    );
    assertEquals(badAmount.error, ClickError.InvalidAmount);
  },
);

Deno.test(
  "complete: fulfills once, duplicate → Already paid, effect not repeated",
  async () => {
    const { store, effects } = memoryStore();
    const prep = await handleClickRequest(await signed({}), CFG, md5, store);
    const prepareId = String(prep.merchant_prepare_id);

    const done = await handleClickRequest(
      await signed({ action: "1", merchant_prepare_id: prepareId }),
      CFG,
      md5,
      store,
    );
    assertEquals(done.error, ClickError.Success);
    assertEquals(done.merchant_confirm_id, prep.merchant_prepare_id);
    assertEquals(effects.fulfilled, 1);

    const dup = await handleClickRequest(
      await signed({ action: "1", merchant_prepare_id: prepareId }),
      CFG,
      md5,
      store,
    );
    assertEquals(dup.error, ClickError.AlreadyPaid);
    assertEquals(effects.fulfilled, 1);
  },
);

Deno.test(
  "complete: unknown transaction / prepare id mismatch → -6",
  async () => {
    const { store } = memoryStore();
    const missing = await handleClickRequest(
      await signed({ action: "1", merchant_prepare_id: "42" }),
      CFG,
      md5,
      store,
    );
    assertEquals(missing.error, ClickError.TransactionNotFound);

    await handleClickRequest(await signed({}), CFG, md5, store);
    const mismatch = await handleClickRequest(
      await signed({ action: "1", merchant_prepare_id: "9999" }),
      CFG,
      md5,
      store,
    );
    assertEquals(mismatch.error, ClickError.TransactionNotFound);
  },
);

Deno.test(
  "complete with negative error from Click cancels the transaction",
  async () => {
    const { store, effects, txs } = memoryStore();
    const prep = await handleClickRequest(await signed({}), CFG, md5, store);

    const cancelled = await handleClickRequest(
      await signed({
        action: "1",
        merchant_prepare_id: String(prep.merchant_prepare_id),
        error: "-5017",
      }),
      CFG,
      md5,
      store,
    );
    assertEquals(cancelled.error, ClickError.Cancelled);
    assertEquals(effects.fulfilled, 0);
    assertEquals(txs.get("ct-1")!.status, "cancelled");

    // Prepare retry for a cancelled transaction reports it as cancelled.
    const again = await handleClickRequest(await signed({}), CFG, md5, store);
    assertEquals(again.error, ClickError.Cancelled);
  },
);

Deno.test("unknown action → -3, missing params → -8", async () => {
  const { store } = memoryStore();
  const badAction = await handleClickRequest(
    await signed({ action: "7" }),
    CFG,
    md5,
    store,
  );
  assertEquals(badAction.error, ClickError.ActionNotFound);

  const missing = await handleClickRequest(
    { click_trans_id: "x" } as ClickParams,
    CFG,
    md5,
    store,
  );
  assertEquals(missing.error, ClickError.RequestError);
});
