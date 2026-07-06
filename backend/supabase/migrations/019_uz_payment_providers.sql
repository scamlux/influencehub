-- ─────────────────────────────────────────────────────────────────────────────
-- T-05 / T-06: Uzbek payment providers (Payme Merchant API, Click SHOPAPI).
--
-- Money is stored as integers only: Payme amounts in tiyin (UZS × 100),
-- Click amounts in tiyin as well (Click sends UZS with decimals — the edge
-- function converts). Provider transaction tables are written exclusively by
-- edge functions via service_role; RLS blocks direct client access (admins
-- read through the api layer's service-backed views or the payments table).
-- ─────────────────────────────────────────────────────────────────────────────

-- payments: generalize beyond Stripe.
alter table public.payments add column if not exists provider text not null default 'stripe';
alter table public.payments add column if not exists provider_ref text;
alter table public.payments add column if not exists deal_id uuid references public.deals(id) on delete set null;
create index if not exists idx_payments_provider_ref on public.payments(provider, provider_ref);

-- ─── Payme Merchant API transactions ─────────────────────────────────────────
create table if not exists public.payme_transactions (
  id                     uuid primary key default gen_random_uuid(),
  paycom_transaction_id  text unique not null,
  paycom_time            bigint not null,
  amount                 bigint not null, -- tiyin
  account                jsonb not null,
  state                  integer not null default 1, -- 1|2|-1|-2 per spec
  reason                 integer,
  create_time            bigint not null,
  perform_time           bigint not null default 0,
  cancel_time            bigint not null default 0,
  user_id                uuid references auth.users(id) on delete set null,
  plan_type              text,
  deal_id                uuid references public.deals(id) on delete set null,
  created_at             timestamptz default now()
);
create index if not exists idx_payme_tx_account on public.payme_transactions using gin(account);
create index if not exists idx_payme_tx_state on public.payme_transactions(state);

alter table public.payme_transactions enable row level security;
-- service_role bypasses RLS; admins may inspect raw provider transactions.
drop policy if exists "admin_read_payme_tx" on public.payme_transactions;
create policy "admin_read_payme_tx" on public.payme_transactions
  for select using (public.is_admin());

-- ─── Click SHOPAPI transactions ──────────────────────────────────────────────
create table if not exists public.click_transactions (
  id              uuid primary key default gen_random_uuid(),
  -- Click expects an integer merchant_prepare_id echoed back on Complete.
  merchant_prepare_id bigint generated always as identity unique,
  click_trans_id  text unique not null,
  merchant_trans_id text not null, -- our order reference (user/plan or deal)
  amount          bigint not null, -- tiyin
  action          integer not null, -- 0 = prepare, 1 = complete
  status          text not null default 'prepared'
                  check (status in ('prepared','completed','cancelled')),
  error_code      integer not null default 0,
  user_id         uuid references auth.users(id) on delete set null,
  plan_type       text,
  deal_id         uuid references public.deals(id) on delete set null,
  created_at      timestamptz default now(),
  completed_at    timestamptz
);
create index if not exists idx_click_tx_merchant on public.click_transactions(merchant_trans_id);

alter table public.click_transactions enable row level security;
drop policy if exists "admin_read_click_tx" on public.click_transactions;
create policy "admin_read_click_tx" on public.click_transactions
  for select using (public.is_admin());
