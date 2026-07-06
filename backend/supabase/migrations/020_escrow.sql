-- ─────────────────────────────────────────────────────────────────────────────
-- T-12 / T-13: escrow schema + extended deal status machine.
--
-- New deal lifecycle:  pending → funded → in_progress → delivered → released
--                      (disputed is a red branch from funded/in_progress/delivered)
-- Legacy statuses (active, content_submitted, approved, completed, cancelled)
-- stay valid so existing rows and seeds keep working; the UI maps them onto
-- the new stepper.
--
-- Money: integer cents (USD). PLATFORM_FEE_PCT is a config constant (12) in
-- the app/edge layer; the actual fee is snapshotted per payment at funding
-- time so a later config change never rewrites history.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals add constraint deals_status_check check (status in (
  -- new escrow lifecycle
  'pending','funded','in_progress','delivered','released','disputed',
  -- legacy values
  'active','content_submitted','approved','completed','cancelled'
));

-- ─── deal_payments: money held in escrow for a deal ──────────────────────────
create table if not exists public.deal_payments (
  id             uuid primary key default gen_random_uuid(),
  deal_id        uuid not null references public.deals(id) on delete cascade,
  brand_user_id  uuid references auth.users(id) on delete set null,
  amount_cents   bigint not null check (amount_cents > 0),   -- gross, USD cents
  fee_cents      bigint not null check (fee_cents >= 0),     -- platform commission
  payout_cents   bigint not null check (payout_cents >= 0),  -- influencer share
  currency       text not null default 'USD',
  provider       text not null default 'mock',               -- mock|stripe|payme|click
  provider_ref   text,                                       -- provider transaction id
  status         text not null default 'held'
                 check (status in ('held','released','refunded','paid_out')),
  held_at        timestamptz default now(),
  released_at    timestamptz,
  created_at     timestamptz default now(),
  constraint deal_payments_sum check (amount_cents = fee_cents + payout_cents)
);
create unique index if not exists idx_deal_payments_active_deal
  on public.deal_payments(deal_id) where status in ('held','released');
create index if not exists idx_deal_payments_status on public.deal_payments(status);

alter table public.deal_payments enable row level security;

-- Both deal parties can see the payment; nobody mutates it from the client
-- (funding/release run through edge functions or the service role).
drop policy if exists "deal_parties_read_payment" on public.deal_payments;
create policy "deal_parties_read_payment" on public.deal_payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.deals d
      left join public.brand_profiles b on b.id = d.brand_id
      left join public.influencer_profiles i on i.id = d.influencer_id
      where d.id = deal_payments.deal_id
        and (b.user_id = auth.uid() or i.user_id = auth.uid())
    )
  );

-- ─── payouts: queue of money owed to influencers after release ───────────────
create table if not exists public.payouts (
  id              uuid primary key default gen_random_uuid(),
  deal_payment_id uuid not null unique references public.deal_payments(id) on delete cascade,
  deal_id         uuid not null references public.deals(id) on delete cascade,
  influencer_id   uuid references public.influencer_profiles(id) on delete set null,
  amount_cents    bigint not null check (amount_cents > 0),
  currency        text not null default 'USD',
  status          text not null default 'pending'
                  check (status in ('pending','paid','failed')),
  paid_at         timestamptz,
  paid_by         uuid references auth.users(id) on delete set null,
  note            text,
  created_at      timestamptz default now()
);
create index if not exists idx_payouts_status on public.payouts(status);

alter table public.payouts enable row level security;

drop policy if exists "influencer_read_own_payouts" on public.payouts;
create policy "influencer_read_own_payouts" on public.payouts
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.influencer_profiles i
      where i.id = payouts.influencer_id and i.user_id = auth.uid()
    )
  );

-- Admins mark payouts as paid from the admin panel (T-15).
drop policy if exists "admin_update_payouts" on public.payouts;
create policy "admin_update_payouts" on public.payouts
  for update using (public.is_admin());
