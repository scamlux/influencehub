-- ═════════════════════════════════════════════════════════════════════════════
-- 021_security_hardening.sql
--
-- Closes two authorization holes surfaced by the production-readiness audit:
--
--   P0-1  Privilege escalation: any signed-up user could INSERT
--         {user_id: self, role: 'admin'} into user_roles because the
--         insert_own_role policy only checked user_id = auth.uid(). That made
--         is_admin() return true and handed them read/write over every
--         payments/deals/payouts row. Fix: clients may only self-assign the two
--         non-privileged roles; 'admin' is provisioned out-of-band (service_role
--         / SQL) or granted by an existing admin via admin_manage_roles.
--
--   P1-1  Deal tampering: update_deals had a USING clause but no WITH CHECK and
--         no column-level protection, so a party could rewrite agreed_price
--         (over/under-charge) or jump status straight to a money state. Fix:
--         mirror USING into WITH CHECK (party integrity) and add a BEFORE UPDATE
--         trigger that freezes financial/identity columns and reserves the
--         escrow money states (funded, released) for the service-role edge
--         functions that actually move the money (fund-deal / release-deal).
--
-- Idempotent: safe to re-run.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── P0-1: forbid client-side self-promotion to admin ────────────────────────
-- Only brand/influencer may be self-assigned. Existing admins are untouched
-- (this governs INSERT only); the first admin is seeded via service_role/SQL,
-- and admins promote others through the existing admin_manage_roles UPDATE
-- policy. There is no DELETE policy on user_roles, so a user cannot drop their
-- row to re-insert a privileged one, and user_id is UNIQUE so they get one role.
alter policy "insert_own_role" on public.user_roles
  with check (
    user_id = auth.uid()
    and role in ('brand', 'influencer')
  );

-- ─── P1-1: party integrity on deal updates (defense in depth) ────────────────
-- WITH CHECK forbids reassigning a deal to a brand/influencer the caller does
-- not own. The USING clause (unchanged) already restricts *which* rows a caller
-- may target; WITH CHECK restricts what the row may look like afterwards.
alter policy "update_deals" on public.deals
  with check (
    brand_id in (select id from public.brand_profiles where user_id = auth.uid())
    or influencer_id in (select id from public.influencer_profiles where user_id = auth.uid())
    or public.is_admin()
  );

-- ─── P1-1: freeze money/identity columns + reserve escrow states ─────────────
-- The escrow edge functions (fund-deal, release-deal) use the service-role key,
-- which bypasses RLS but NOT triggers — so this trigger fires for them too and
-- must let them through. End users (role = 'authenticated') are held to the
-- legitimate transitions their two UIs perform: the legacy stepper
-- (content_submitted → approved → completed, cancel) and the escrow stepper
-- (start → in_progress, deliver → delivered, dispute). Money states are not on
-- that list, so setting them from a client is rejected here.
create or replace function public.enforce_deal_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Service role (escrow functions / admin tooling) is fully trusted. Read the
  -- role from the JWT claims directly — auth.role() is deprecated and may be
  -- absent, which would throw on every deal UPDATE.
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  -- Financial and identity columns are immutable from the client. No legitimate
  -- client flow updates any of these; only status / content_url / review /
  -- rating / completed_at change over a deal's life.
  if new.agreed_price  is distinct from old.agreed_price
     or new.brand_id      is distinct from old.brand_id
     or new.influencer_id is distinct from old.influencer_id
     or new.campaign_id   is distinct from old.campaign_id
     or new.bid_id        is distinct from old.bid_id then
    raise exception
      'deal %: agreed_price and party/campaign links are immutable', old.id
      using errcode = 'check_violation';
  end if;

  -- Escrow money states are owned by the service-role edge functions that move
  -- the actual funds (fund-deal sets funded, release-deal sets released). A
  -- client must never be able to fake them.
  if new.status is distinct from old.status
     and new.status in ('funded', 'released') then
    raise exception
      'deal %: status "%" may only be set by the escrow service', old.id, new.status
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_deal_update on public.deals;
create trigger trg_enforce_deal_update
  before update on public.deals
  for each row execute function public.enforce_deal_update();
