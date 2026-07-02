-- 019_escrow.sql  (T-12 — Escrow schema)
-- Ledger for the take-rate model: a brand funds a deal, the platform holds the
-- money until the work is released, then an influencer payout is queued.
--
--   deal_payments : brand-side funding of a deal (pending → held → released/refunded)
--   payouts       : platform → influencer disbursement (queued → processing → paid/failed)
--
-- Money movement is written server-side (service role); clients only read their own rows.

-- ── deal_payments ─────────────────────────────────────────────────────────────
create table if not exists public.deal_payments (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references public.deals(id) on delete cascade,
  brand_id        uuid references public.brand_profiles(id) on delete set null,
  amount          numeric(12,2) not null,             -- gross the brand funds
  platform_fee    numeric(12,2) not null default 0,   -- platform take (10–15%)
  currency        text not null default 'UZS',
  provider        text,                               -- 'payme' | 'stripe' | ...
  provider_txn_id text,                               -- external transaction reference
  status          text not null default 'pending'
                  check (status in ('pending','held','released','refunded')),
  funded_at       timestamptz,
  released_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_deal_payments_deal on public.deal_payments (deal_id);
create index if not exists idx_deal_payments_brand on public.deal_payments (brand_id);

-- ── payouts ───────────────────────────────────────────────────────────────────
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  deal_payment_id uuid references public.deal_payments(id) on delete set null,
  influencer_id   uuid references public.influencer_profiles(id) on delete set null,
  amount          numeric(12,2) not null,             -- net to influencer (gross − fee)
  currency        text not null default 'UZS',
  status          text not null default 'queued'
                  check (status in ('queued','processing','paid','failed')),
  method          text,                               -- payout channel
  reference       text,                               -- external payout ref
  paid_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_payouts_influencer on public.payouts (influencer_id);
create index if not exists idx_payouts_status on public.payouts (status);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.deal_payments enable row level security;
alter table public.payouts enable row level security;

-- Brands read the funding rows for their own deals; admins read all. All writes go
-- through the service role (edge functions), which bypasses RLS.
create policy "brand_read_deal_payments" on public.deal_payments
  for select using (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- Influencers read their own payouts; admins read all.
create policy "influencer_read_payouts" on public.payouts
  for select using (
    influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- Admin queue management (T-15) still runs server-side, but allow admin writes so the
-- existing admin panel can update payout status directly if needed.
create policy "admin_write_payouts" on public.payouts
  for update using (public.is_admin());
