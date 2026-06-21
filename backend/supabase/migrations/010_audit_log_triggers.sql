-- ============================================================================
-- InfluenceHub — 010_audit_log_triggers.sql
-- Populate the admin audit log (admin_actions) automatically.
--
-- AFTER INSERT/UPDATE/DELETE triggers on the admin-relevant tables write a row
-- to public.admin_actions with the acting user (auth.uid(), may be null for
-- service-role/cron writes), the operation, the table, the row id and a JSON
-- snapshot. High-churn tables (influencer_profiles, social_platforms,
-- analytics_history) are intentionally NOT audited so the daily refresh doesn't
-- flood the log.
-- ============================================================================

create or replace function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec_id  uuid;
  payload jsonb;
begin
  if (tg_op = 'DELETE') then
    rec_id := old.id; payload := to_jsonb(old);
  else
    rec_id := new.id; payload := to_jsonb(new);
  end if;

  insert into public.admin_actions (admin_id, action_type, target_table, target_id, details)
    values (auth.uid(), tg_op, tg_table_name, rec_id, payload);

  return null; -- AFTER trigger: return value ignored
end;
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['deals', 'campaigns', 'user_roles', 'subscriptions'] loop
    execute format('drop trigger if exists audit_%1$s on public.%1$s', tbl);
    execute format(
      'create trigger audit_%1$s after insert or update or delete on public.%1$s ' ||
      'for each row execute function public.log_admin_action()', tbl);
  end loop;
end $$;
