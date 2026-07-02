-- 018_payme_transactions.sql
-- Payme (Paycom) Merchant API transaction ledger.
--
-- The Merchant API is stateful: Payme calls CreateTransaction / PerformTransaction /
-- CancelTransaction against *our* endpoint and expects us to persist each transaction's
-- lifecycle (state + timestamps) so repeated calls are idempotent. This table is that
-- ledger. Only the `payme-webhook` edge function (service-role, bypasses RLS) writes here.
--
-- A Payme "account" maps to one pending row in public.payments (order_id = payments.id);
-- process-subscription creates that pending payment before redirecting to checkout.

-- Distinguish payment providers on the existing payments table (default keeps Stripe rows valid).
alter table public.payments add column if not exists provider text not null default 'stripe';

create table if not exists public.payme_transactions (
  id           uuid primary key default gen_random_uuid(),
  paycom_id    text not null unique,                              -- Payme transaction id (params.id)
  order_id     uuid not null references public.payments(id) on delete cascade,
  amount       bigint not null,                                   -- tiyin (1 UZS = 100 tiyin)
  state        int  not null default 1,                           -- 1 created · 2 performed · -1/-2 cancelled
  reason       int,                                               -- Payme cancellation reason code
  create_time  bigint not null default 0,                        -- ms since epoch
  perform_time bigint not null default 0,
  cancel_time  bigint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_payme_tx_order on public.payme_transactions (order_id);

-- Ledger is server-only. Enable RLS with no policies → all client roles are denied;
-- the edge function uses the service role which bypasses RLS entirely.
alter table public.payme_transactions enable row level security;
