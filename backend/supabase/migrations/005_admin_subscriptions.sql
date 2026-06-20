-- Allow admins to update subscriptions (e.g. cancel from the admin panel).
-- The base policy only grants SELECT (own + admin); without an UPDATE policy an
-- admin's cancel would be silently filtered out by RLS.

drop policy if exists "admin_manage_subscriptions" on public.subscriptions;
create policy "admin_manage_subscriptions" on public.subscriptions
  for update using (public.is_admin());
