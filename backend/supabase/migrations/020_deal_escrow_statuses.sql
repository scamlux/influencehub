-- 020_deal_escrow_statuses.sql  (T-13 — Deal status machine)
-- Extend deal.status with the escrow lifecycle on top of the existing marketplace flow.
--
--   existing : active → content_submitted → approved → completed / cancelled
--   escrow   : funded → in_progress → delivered → released   (happy path)
--              disputed                                        (exception, any escrow state)
--
-- Transitions are enforced in the api layer (frontend/src/lib/api.ts DEAL_TRANSITIONS);
-- this migration only widens the DB check constraint so the new values are storable.

alter table public.deals drop constraint if exists deals_status_check;
alter table public.deals
  add constraint deals_status_check check (status in (
    'active','content_submitted','approved','completed','cancelled',
    'funded','in_progress','delivered','released','disputed'
  ));
