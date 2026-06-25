-- ============================================================================
-- 014_cron_cache_avatars.sql
-- Daily job that permanently caches blogger avatars into Supabase Storage.
--
-- Pipeline:
--   03:00  refresh-social-stats (009)  — fetches fresh followers/ER + writes
--                                         each blogger's avatar_url as a social
--                                         CDN URL (Instagram/TikTok/YouTube).
--   03:30  cache-avatars-daily (here)  — re-hosts those URLs into the public
--                                         `avatars` bucket and rewrites
--                                         avatar_url to the stable bucket URL.
--
-- Social CDN avatar URLs are signed, expire, and block hot-linking, so they
-- can't be shown directly in the browser. The `cache-avatars` edge function
-- downloads the bytes server-side and stores them once; this job drives it
-- daily so freshly-refreshed photos get re-hosted. The anon key below is the
-- public client key (also in .env.example) — it only authorizes invoking the
-- edge function, which runs with the service role internally.
-- ============================================================================

create extension if not exists http with schema extensions;

create or replace function private.refresh_avatars()
returns void
language plpgsql
security definer
set search_path = private, public, extensions
as $fn$
declare
  v_resp  text;
  v_proc  int;
  v_guard int := 0;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '290000');
  set local statement_timeout = 0;

  -- Re-host in batches of 40 until a short page signals there's nothing left.
  loop
    v_guard := v_guard + 1;
    begin
      select content into v_resp from extensions.http((
        'POST',
        'https://ceqpcuhguxjdbzuuwamr.supabase.co/functions/v1/cache-avatars',
        array[extensions.http_header(
          'Authorization',
          'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlcXBjdWhndXhqZGJ6dXV3YW1yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5MjI2NjIsImV4cCI6MjA5NzQ5ODY2Mn0.mM57BY5csrf67uY9E9X4ft6jKxpf3WKH57r6HLwnoas'
        )],
        'application/json',
        '{"limit":40}'
      )::extensions.http_request);
    exception when others then
      raise notice 'refresh_avatars failed: %', sqlerrm;
      exit;
    end;
    v_proc := coalesce((v_resp::jsonb->>'processed')::int, 0);
    exit when v_proc < 40 or v_guard >= 8;
  end loop;
end;
$fn$;

-- Run daily at 03:30, just after the 03:00 social-stats refresh.
do $$ begin perform cron.unschedule('cache-avatars-daily'); exception when others then null; end $$;
select cron.schedule('cache-avatars-daily', '30 3 * * *', $$ select private.refresh_avatars(); $$);
