// Click SHOPAPI — protocol core (Prepare / Complete).
//
// Runtime-agnostic: md5 and persistence are injected, so the whole protocol
// is unit-testable (core_test.ts). Spec: https://docs.click.uz/click-api-request/
//
// Click calls the endpoint twice per payment:
//   action=0 (Prepare)  — validate the order, reserve a merchant_prepare_id
//   action=1 (Complete) — confirm (error=0) or cancel (error<0) the payment

export const ClickError = {
  Success: 0,
  SignFailed: -1,
  InvalidAmount: -2,
  ActionNotFound: -3,
  AlreadyPaid: -4,
  OrderNotFound: -5,
  TransactionNotFound: -6,
  RequestError: -8,
  Cancelled: -9,
} as const;

/** Raw request fields exactly as Click sends them (all strings). */
export interface ClickParams {
  click_trans_id?: string;
  service_id?: string;
  click_paydoc_id?: string;
  merchant_trans_id?: string;
  merchant_prepare_id?: string;
  amount?: string;
  action?: string;
  error?: string;
  error_note?: string;
  sign_time?: string;
  sign_string?: string;
}

export interface ClickTx {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id: number;
  amount: number; // tiyin
  status: "prepared" | "completed" | "cancelled";
}

export type ClickOrderValidation =
  | { ok: true; expectedTiyin: number }
  | { ok: false; error: number; note: string };

export interface ClickStore {
  validateOrder(merchantTransId: string): Promise<ClickOrderValidation>;
  getByClickTransId(clickTransId: string): Promise<ClickTx | null>;
  /** Insert a prepared transaction; returns the new merchant_prepare_id. */
  insertPrepared(tx: {
    click_trans_id: string;
    merchant_trans_id: string;
    amountTiyin: number;
  }): Promise<number>;
  markCompleted(clickTransId: string): Promise<void>;
  markCancelled(clickTransId: string, errorCode: number): Promise<void>;
  /** Apply the business effect (activate subscription / fund deal). */
  fulfill(tx: ClickTx): Promise<void>;
}

export type Md5 = (s: string) => string | Promise<string>;

export interface ClickResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: number;
  merchant_confirm_id?: number;
  error: number;
  error_note: string;
}

function respond(
  p: ClickParams,
  error: number,
  note: string,
  extra: Partial<ClickResponse> = {},
): ClickResponse {
  return {
    click_trans_id: p.click_trans_id ?? "",
    merchant_trans_id: p.merchant_trans_id ?? "",
    error,
    error_note: note,
    ...extra,
  };
}

/** Click amounts arrive as decimal UZS strings ("125000.00") → tiyin. */
export function clickAmountToTiyin(amount: string | undefined): number {
  return Math.round(Number(amount ?? "0") * 100);
}

async function verifySign(
  p: ClickParams,
  secretKey: string,
  md5: Md5,
): Promise<boolean> {
  const action = p.action ?? "";
  const base =
    action === "1"
      ? `${p.click_trans_id}${p.service_id}${secretKey}${p.merchant_trans_id}${p.merchant_prepare_id}${p.amount}${action}${p.sign_time}`
      : `${p.click_trans_id}${p.service_id}${secretKey}${p.merchant_trans_id}${p.amount}${action}${p.sign_time}`;
  const expected = await md5(base);
  return expected.toLowerCase() === (p.sign_string ?? "").toLowerCase();
}

export async function handleClickRequest(
  p: ClickParams,
  cfg: { secretKey: string; serviceId: string },
  md5: Md5,
  store: ClickStore,
): Promise<ClickResponse> {
  if (
    !p.click_trans_id ||
    !p.merchant_trans_id ||
    !p.sign_time ||
    !p.sign_string
  ) {
    return respond(p, ClickError.RequestError, "Missing required parameters");
  }
  if (
    p.service_id !== cfg.serviceId ||
    !(await verifySign(p, cfg.secretKey, md5))
  ) {
    return respond(p, ClickError.SignFailed, "Sign check failed");
  }

  const amountTiyin = clickAmountToTiyin(p.amount);

  // ─── Prepare ───────────────────────────────────────────────────────────────
  if (p.action === "0") {
    // Retried Prepare for the same Click transaction → same prepare id.
    const existing = await store.getByClickTransId(p.click_trans_id);
    if (existing) {
      if (existing.status === "completed") {
        return respond(p, ClickError.AlreadyPaid, "Already paid");
      }
      if (existing.status === "cancelled") {
        return respond(p, ClickError.Cancelled, "Transaction cancelled");
      }
      return respond(p, ClickError.Success, "Success", {
        merchant_prepare_id: existing.merchant_prepare_id,
      });
    }

    const v = await store.validateOrder(p.merchant_trans_id);
    if (!v.ok) return respond(p, v.error, v.note);
    if (amountTiyin !== v.expectedTiyin) {
      return respond(p, ClickError.InvalidAmount, "Incorrect amount");
    }

    const merchant_prepare_id = await store.insertPrepared({
      click_trans_id: p.click_trans_id,
      merchant_trans_id: p.merchant_trans_id,
      amountTiyin,
    });
    return respond(p, ClickError.Success, "Success", { merchant_prepare_id });
  }

  // ─── Complete ──────────────────────────────────────────────────────────────
  if (p.action === "1") {
    const tx = await store.getByClickTransId(p.click_trans_id);
    if (
      !tx ||
      String(tx.merchant_prepare_id) !== String(p.merchant_prepare_id ?? "")
    ) {
      return respond(
        p,
        ClickError.TransactionNotFound,
        "Transaction not found",
      );
    }
    if (tx.status === "cancelled") {
      return respond(p, ClickError.Cancelled, "Transaction cancelled");
    }
    if (tx.status === "completed") {
      // Idempotent retry after we already confirmed: signal "already paid".
      return respond(p, ClickError.AlreadyPaid, "Already paid", {
        merchant_confirm_id: tx.merchant_prepare_id,
      });
    }

    // Click reports a failed/cancelled payment with a negative error code.
    const clickError = Number(p.error ?? "0");
    if (clickError < 0) {
      await store.markCancelled(p.click_trans_id, clickError);
      return respond(p, ClickError.Cancelled, "Transaction cancelled");
    }

    if (amountTiyin !== tx.amount) {
      return respond(p, ClickError.InvalidAmount, "Incorrect amount");
    }

    await store.fulfill(tx);
    await store.markCompleted(p.click_trans_id);
    return respond(p, ClickError.Success, "Success", {
      merchant_confirm_id: tx.merchant_prepare_id,
    });
  }

  return respond(p, ClickError.ActionNotFound, "Action not found");
}
