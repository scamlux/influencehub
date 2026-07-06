// Payme Merchant API (JSON-RPC 2.0) — protocol core.
//
// Runtime-agnostic: no Deno or network APIs here; all persistence goes through the
// injected PaymeStore, so the full protocol is unit-testable (core_test.ts).
// Spec: https://developer.help.paycom.uz/protokol-merchant-api
//
// Transaction states (per spec):
//   1  — created (money reserved on the payer side)
//   2  — performed (money captured; business effect applied)
//  -1  — cancelled before perform
//  -2  — cancelled after perform (refund; business effect reverted)

export const TxState = {
  Created: 1,
  Performed: 2,
  Cancelled: -1,
  CancelledAfterPerform: -2,
} as const;

// Payme error codes.
export const PaymeError = {
  InvalidAmount: -31001,
  TransactionNotFound: -31003,
  CannotPerform: -31008,
  AccountNotFound: -31050, // -31050..-31099 reserved for account errors
  AccountBusy: -31099,
  InvalidAuthorization: -32504,
  MethodNotFound: -32601,
  ParseError: -32700,
} as const;

export interface PaymeAccount {
  // Subscription payments: user_id + plan. Deal escrow payments: deal_id.
  user_id?: string;
  plan?: string;
  deal_id?: string;
  [key: string]: string | undefined;
}

export interface PaymeTx {
  paycom_transaction_id: string;
  paycom_time: number;
  amount: number; // tiyin
  account: PaymeAccount;
  state: number;
  reason: number | null;
  create_time: number; // ms epoch
  perform_time: number; // 0 until performed
  cancel_time: number; // 0 until cancelled
}

export type AccountValidation =
  | { ok: true; expectedTiyin: number }
  | { ok: false; code: number; message: string };

export interface PaymeStore {
  getTransaction(paycomId: string): Promise<PaymeTx | null>;
  /** Another *created* (state=1) transaction for the same account. */
  findPendingForAccount(
    account: PaymeAccount,
    excludePaycomId: string,
  ): Promise<PaymeTx | null>;
  insertTransaction(tx: PaymeTx): Promise<void>;
  updateTransaction(paycomId: string, patch: Partial<PaymeTx>): Promise<void>;
  validateAccount(account: PaymeAccount): Promise<AccountValidation>;
  /** Apply the business effect (activate subscription / fund deal). */
  onPerform(tx: PaymeTx): Promise<void>;
  /** Revert the business effect after a refund. */
  onCancelAfterPerform(tx: PaymeTx): Promise<void>;
  now(): number;
}

type RpcRequest = {
  id?: number | string | null;
  method?: string;
  params?: Record<string, unknown>;
};

type RpcResponse = {
  id: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

function err(id: RpcRequest["id"], code: number, message: string): RpcResponse {
  return { id: id ?? null, error: { code, message } };
}

function ok(
  id: RpcRequest["id"],
  result: Record<string, unknown>,
): RpcResponse {
  return { id: id ?? null, result };
}

function txResult(tx: PaymeTx): Record<string, unknown> {
  return {
    transaction: tx.paycom_transaction_id,
    state: tx.state,
    create_time: tx.create_time,
    perform_time: tx.perform_time,
    cancel_time: tx.cancel_time,
    reason: tx.reason,
  };
}

/**
 * Handle one authenticated JSON-RPC request. Authorization (Basic
 * Paycom:<merchant key>) must be verified by the caller *before* this —
 * pass authorized=false to get the spec-compliant -32504 response.
 */
export async function handlePaymeRpc(
  body: unknown,
  store: PaymeStore,
  authorized: boolean,
): Promise<RpcResponse> {
  const req = (body ?? {}) as RpcRequest;
  if (!authorized) {
    return err(
      req.id,
      PaymeError.InvalidAuthorization,
      "Invalid authorization",
    );
  }
  const params = req.params ?? {};

  switch (req.method) {
    case "CheckPerformTransaction": {
      const account = (params.account ?? {}) as PaymeAccount;
      const amount = Number(params.amount);
      const v = await store.validateAccount(account);
      if (!v.ok) return err(req.id, v.code, v.message);
      if (amount !== v.expectedTiyin) {
        return err(req.id, PaymeError.InvalidAmount, "Invalid amount");
      }
      return ok(req.id, { allow: true });
    }

    case "CreateTransaction": {
      const paycomId = String(params.id ?? "");
      const account = (params.account ?? {}) as PaymeAccount;
      const amount = Number(params.amount);

      const existing = await store.getTransaction(paycomId);
      if (existing) {
        // Idempotent retry of the same transaction.
        if (existing.state !== TxState.Created) {
          return err(
            req.id,
            PaymeError.CannotPerform,
            "Transaction already finalized",
          );
        }
        return ok(req.id, {
          transaction: existing.paycom_transaction_id,
          state: existing.state,
          create_time: existing.create_time,
        });
      }

      const v = await store.validateAccount(account);
      if (!v.ok) return err(req.id, v.code, v.message);
      if (amount !== v.expectedTiyin) {
        return err(req.id, PaymeError.InvalidAmount, "Invalid amount");
      }
      // One pending transaction per account at a time (spec recommendation).
      const pending = await store.findPendingForAccount(account, paycomId);
      if (pending) {
        return err(
          req.id,
          PaymeError.AccountBusy,
          "Another transaction is pending for this account",
        );
      }

      const tx: PaymeTx = {
        paycom_transaction_id: paycomId,
        paycom_time: Number(params.time ?? store.now()),
        amount,
        account,
        state: TxState.Created,
        reason: null,
        create_time: store.now(),
        perform_time: 0,
        cancel_time: 0,
      };
      await store.insertTransaction(tx);
      return ok(req.id, {
        transaction: tx.paycom_transaction_id,
        state: tx.state,
        create_time: tx.create_time,
      });
    }

    case "PerformTransaction": {
      const paycomId = String(params.id ?? "");
      const tx = await store.getTransaction(paycomId);
      if (!tx)
        return err(
          req.id,
          PaymeError.TransactionNotFound,
          "Transaction not found",
        );

      if (tx.state === TxState.Performed) {
        // Idempotent: repeated Perform returns the original result.
        return ok(req.id, {
          transaction: tx.paycom_transaction_id,
          state: tx.state,
          perform_time: tx.perform_time,
        });
      }
      if (tx.state !== TxState.Created) {
        return err(
          req.id,
          PaymeError.CannotPerform,
          "Transaction is cancelled",
        );
      }

      const perform_time = store.now();
      await store.onPerform(tx);
      await store.updateTransaction(paycomId, {
        state: TxState.Performed,
        perform_time,
      });
      return ok(req.id, {
        transaction: tx.paycom_transaction_id,
        state: TxState.Performed,
        perform_time,
      });
    }

    case "CancelTransaction": {
      const paycomId = String(params.id ?? "");
      const reason = Number(params.reason ?? 0);
      const tx = await store.getTransaction(paycomId);
      if (!tx)
        return err(
          req.id,
          PaymeError.TransactionNotFound,
          "Transaction not found",
        );

      // Idempotent: already cancelled → return stored result.
      if (
        tx.state === TxState.Cancelled ||
        tx.state === TxState.CancelledAfterPerform
      ) {
        return ok(req.id, {
          transaction: tx.paycom_transaction_id,
          state: tx.state,
          cancel_time: tx.cancel_time,
        });
      }

      const cancel_time = store.now();
      if (tx.state === TxState.Performed) {
        await store.onCancelAfterPerform(tx);
        await store.updateTransaction(paycomId, {
          state: TxState.CancelledAfterPerform,
          cancel_time,
          reason,
        });
        return ok(req.id, {
          transaction: tx.paycom_transaction_id,
          state: TxState.CancelledAfterPerform,
          cancel_time,
        });
      }
      await store.updateTransaction(paycomId, {
        state: TxState.Cancelled,
        cancel_time,
        reason,
      });
      return ok(req.id, {
        transaction: tx.paycom_transaction_id,
        state: TxState.Cancelled,
        cancel_time,
      });
    }

    case "CheckTransaction": {
      const paycomId = String(params.id ?? "");
      const tx = await store.getTransaction(paycomId);
      if (!tx)
        return err(
          req.id,
          PaymeError.TransactionNotFound,
          "Transaction not found",
        );
      return ok(req.id, txResult(tx));
    }

    default:
      return err(
        req.id,
        PaymeError.MethodNotFound,
        `Method not found: ${req.method ?? ""}`,
      );
  }
}

/** Verify Payme's Basic auth header: base64("Paycom:<merchant key>"). */
export function isAuthorized(
  authHeader: string | null,
  merchantKeys: string[],
): boolean {
  if (!authHeader?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authHeader.slice(6).trim());
  } catch {
    return false;
  }
  const sep = decoded.indexOf(":");
  if (sep < 0) return false;
  const login = decoded.slice(0, sep);
  const key = decoded.slice(sep + 1);
  return login === "Paycom" && merchantKeys.some((k) => k && k === key);
}
