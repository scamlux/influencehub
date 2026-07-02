-- 021_click_transactions.sql  (T-06 — Click provider)
-- Click (Click.uz) uses a two-step Prepare/Complete callback. We must persist the
-- merchant_prepare_id created during Prepare so Complete can be matched to it. Same
-- server-only pattern as payme_transactions.

create table if not exists public.click_transactions (
  id              uuid primary key default gen_random_uuid(),
  click_trans_id  text not null,                    -- Click's transaction id
  order_id        uuid not null references public.payments(id) on delete cascade,
  amount          numeric(12,2) not null,           -- UZS
  prepare_id      bigint,                            -- merchant_prepare_id we return on Prepare
  state           int not null default 0            -- 0 prepared · 1 completed · -1 cancelled
                  check (state in (0, 1, -1)),
  created_at      timestamptz not null default now(),
  unique (click_trans_id, order_id)
);
create index if not exists idx_click_tx_order on public.click_transactions (order_id);

alter table public.click_transactions enable row level security;
-- Server-only (service role bypasses RLS); no client policies.
