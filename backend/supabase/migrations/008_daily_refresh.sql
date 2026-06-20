-- ============================================================================
-- InfluenceHub — 008_daily_refresh.sql
-- Daily, fully in-database refresh of every blogger's social stats using
-- pg_cron (scheduler) + pg_net (async HTTP). No external scheduler required.
--
-- Pipeline:
--   1. 03:00 UTC daily — enqueue every visible, unclaimed blogger into
--      scraping_queue (skipping ones already pending/processing).
--   2. every 5 min   — POST to the `process-scraping-queue` edge function,
--      which calls `fetch-social-stats` (real YouTube / Instagram / TikTok when
--      the provider secrets are set), writes fresh numbers to social_platforms,
--      appends an influencer_analytics_history row, and re-ranks the league.
--      It is a no-op when the queue is empty.
--
-- ── ONE-TIME SETUP (required before the cron can call the function) ──────────
-- Store the project URL + service-role key so pg_net can authenticate. Run once
-- with your real values (the service-role key is in Supabase → Settings → API):
--
--   update private.app_settings set value = 'https://<ref>.supabase.co'
--     where key = 'project_url';
--   update private.app_settings set value = '<your-service-role-key>'
--     where key = 'service_role_key';
--
-- private.* is NOT exposed through PostgREST (the API only serves `public`),
-- so the key is never reachable from the browser/anon client.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ── secure settings store (private schema → not in the REST API) ─────────────
create schema if not exists private;

create table if not exists private.app_settings (
  key   text primary key,
  value text
);
revoke all on private.app_settings from anon, authenticated;

insert into private.app_settings (key, value) values
  ('project_url', null),
  ('service_role_key', null)
on conflict (key) do nothing;

create or replace function private.setting(p_key text)
returns text
language sql
stable
security definer
set search_path = private
as $$
  select value from private.app_settings where key = p_key;
$$;

-- ── 1. enqueue every blogger that isn't already queued ───────────────────────
create or replace function private.enqueue_all_bloggers()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  insert into public.scraping_queue (influencer_id, status)
  select ip.id, 'pending'
    from public.influencer_profiles ip
   where ip.is_visible = true
     and not exists (
       select 1 from public.scraping_queue q
        where q.influencer_id = ip.id
          and q.status in ('pending', 'processing')
     );
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ── 2. drain the queue via the edge function (async, fire-and-forget) ────────
create or replace function private.run_scraping_worker(p_limit integer default 20)
returns bigint
language plpgsql
security definer
set search_path = private, public
as $$
declare
  v_url text := private.setting('project_url');
  v_key text := private.setting('service_role_key');
  v_req bigint;
begin
  if v_url is null or v_key is null then
    raise notice 'run_scraping_worker: project_url / service_role_key not set — skipping';
    return null;
  end if;

  select net.http_post(
    url     := v_url || '/functions/v1/process-scraping-queue',
    body    := jsonb_build_object('limit', p_limit),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    timeout_milliseconds := 30000
  ) into v_req;

  return v_req;
end;
$$;

-- ── schedule (idempotent: unschedule any previous run first) ─────────────────
do $$
begin
  perform cron.unschedule('enqueue-bloggers-daily');
exception when others then null;
end $$;
do $$
begin
  perform cron.unschedule('drain-scraping-queue');
exception when others then null;
end $$;

-- 03:00 UTC every day — refill the queue with all bloggers.
select cron.schedule(
  'enqueue-bloggers-daily',
  '0 3 * * *',
  $$ select private.enqueue_all_bloggers(); $$
);

-- Every 5 minutes — drain whatever is pending (no-op when empty).
select cron.schedule(
  'drain-scraping-queue',
  '*/5 * * * *',
  $$ select private.run_scraping_worker(20); $$
);
