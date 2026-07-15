-- ═════════════════════════════════════════════════════════════════════════════
-- 022_influencer_claims.sql
--
-- P0-2: proof-of-ownership for claiming a scraped (user_id = null) influencer
-- profile. Previously claim-influencer linked ANY unclaimed profile to whoever
-- called it — a stranger could seize a blogger's rating, prices and contacts.
--
-- This table backs a two-step verify flow (see the claim-influencer function):
--   1. initiate → a random code is stored here (status pending_code) and shown
--      to the claimant to place in their channel/bio.
--   2. verify   → the function re-reads the live profile; on a code match the
--      claim flips to 'verified' and the profile is linked. Platforms we cannot
--      yet read live (IG/TT/Telegram) go to 'pending_admin' — never auto-granted.
--
-- Writes happen only through the service-role edge function; clients may read
-- their own claim rows (to poll status) but cannot insert/update them.
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.influencer_claims (
  id                uuid primary key default gen_random_uuid(),
  influencer_id     uuid not null references public.influencer_profiles(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  platform          text check (platform in ('youtube','instagram','tiktok','telegram')),
  verification_code text not null,
  status            text not null default 'pending_code'
                      check (status in ('pending_code','pending_admin','verified','rejected','expired')),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '24 hours'),
  verified_at       timestamptz
);

create index if not exists idx_claims_influencer on public.influencer_claims(influencer_id);
create index if not exists idx_claims_user       on public.influencer_claims(user_id);

-- At most one live claim attempt per (influencer, user). Verified/rejected rows
-- stay as history; a new attempt is allowed once the prior one is resolved.
create unique index if not exists uniq_active_claim
  on public.influencer_claims(influencer_id, user_id)
  where status in ('pending_code', 'pending_admin');

alter table public.influencer_claims enable row level security;

-- Owners may read their own claims (to poll status); admins read all. No client
-- INSERT/UPDATE policy exists, so all writes must come from the service role.
drop policy if exists "read_own_claims" on public.influencer_claims;
create policy "read_own_claims" on public.influencer_claims
  for select using (user_id = auth.uid() or public.is_admin());
