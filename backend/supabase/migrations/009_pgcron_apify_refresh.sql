-- ============================================================================
-- InfluenceHub — 009_pgcron_apify_refresh.sql
-- In-database daily refresh of follower counts, engagement AND avatars, using
-- pg_cron (scheduler) + the http extension (synchronous outbound HTTP).
--
--   Instagram → Apify  apify~instagram-profile-scraper   (followers, ER, avatar)
--   TikTok    → Apify  clockworks~tiktok-scraper         (followers, ER, avatar)
--   YouTube   → YouTube Data API v3                      (subs, ER, avatar)
--
-- Avatars are written to influencer_profiles.avatar_url every run (Instagram /
-- TikTok CDN URLs are signed + expire, so they must be refreshed). Priority is
-- Instagram > TikTok > YouTube, enforced by call order in refresh_social_stats().
-- A platform is only updated when the provider returns a real number; existing
-- values are never overwritten with placeholders.
--
-- Supersedes the 008 edge-function/pg_net worker (its cron jobs are unscheduled
-- below). Provider keys live in private.app_settings (not exposed via the API):
--   update private.app_settings set value='<apify-token>'      where key='apify_token';
--   update private.app_settings set value='<youtube-api-key>'  where key='youtube_api_key';
-- ============================================================================

create extension if not exists http with schema extensions;

insert into private.app_settings (key, value) values
  ('apify_token', null),
  ('youtube_api_key', null)
on conflict (key) do nothing;

-- ── Instagram (Apify, batched) ───────────────────────────────────────────────
create or replace function private.refresh_instagram()
returns integer
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_token text := private.setting('apify_token');
  v_users text[];
  v_batch text[];
  v_url   text;
  v_body  text;
  v_json  jsonb;
  e       jsonb;
  v_user  text;
  v_foll  bigint;
  v_er    numeric;
  v_avatar text;
  v_inf   uuid;
  i       int;
  n       int := 0;
begin
  if v_token is null then raise notice 'refresh_instagram: no apify_token'; return 0; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '290000');
  set local statement_timeout = 0;

  select array_agg(distinct lower(replace(username, '@', '')))
    into v_users
    from public.social_platforms
   where platform = 'instagram' and username is not null;
  if v_users is null then return 0; end if;

  v_url := 'https://api.apify.com/v2/acts/apify~instagram-profile-scraper'
        || '/run-sync-get-dataset-items?token=' || v_token;

  i := 1;
  while i <= array_length(v_users, 1) loop
    v_batch := v_users[i : i + 24];
    i := i + 25;
    begin
      select content into v_body from extensions.http_post(
        v_url, jsonb_build_object('usernames', to_jsonb(v_batch))::text, 'application/json');
      v_json := v_body::jsonb;
    exception when others then
      raise notice 'refresh_instagram batch failed: %', sqlerrm; continue;
    end;

    for e in select jsonb_array_elements(v_json) loop
      v_user := lower(e->>'username');
      v_foll := nullif(e->>'followersCount', '')::bigint;
      if v_user is null or coalesce(v_foll, 0) = 0 then continue; end if;
      v_avatar := coalesce(e->>'profilePicUrlHD', e->>'profilePicUrl');
      v_er := (select coalesce(avg((p->>'likesCount')::numeric
                                   + coalesce((p->>'commentsCount')::numeric, 0)), 0)
                 from jsonb_array_elements(coalesce(e->'latestPosts', '[]'::jsonb)) p);
      v_er := case when v_foll > 0 then round(least(100, v_er / v_foll * 100), 2) else 0 end;

      for v_inf in
        select influencer_id from public.social_platforms
         where platform = 'instagram' and lower(replace(username, '@', '')) = v_user
      loop
        update public.social_platforms
           set followers_count = v_foll, engagement_rate = nullif(v_er, 0)
         where platform = 'instagram' and influencer_id = v_inf;
        insert into public.influencer_analytics_history
          (influencer_id, platform, followers_count, engagement_rate)
          values (v_inf, 'instagram', v_foll, nullif(v_er, 0));
        if v_avatar is not null then
          update public.influencer_profiles set avatar_url = v_avatar where id = v_inf;
        end if;
        n := n + 1;
      end loop;
    end loop;
  end loop;
  return n;
end;
$$;

-- ── TikTok (Apify, batched) ──────────────────────────────────────────────────
create or replace function private.refresh_tiktok()
returns integer
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_token text := private.setting('apify_token');
  v_users text[];
  v_batch text[];
  v_url   text;
  v_body  text;
  v_json  jsonb;
  e       jsonb;
  m       jsonb;
  v_user  text;
  v_foll  bigint;
  v_er    numeric;
  v_hearts numeric;
  v_videos numeric;
  v_avatar text;
  v_inf   uuid;
  i       int;
  n       int := 0;
begin
  if v_token is null then raise notice 'refresh_tiktok: no apify_token'; return 0; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '290000');
  set local statement_timeout = 0;

  select array_agg(distinct lower(replace(username, '@', '')))
    into v_users
    from public.social_platforms
   where platform = 'tiktok' and username is not null;
  if v_users is null then return 0; end if;

  v_url := 'https://api.apify.com/v2/acts/clockworks~tiktok-scraper'
        || '/run-sync-get-dataset-items?token=' || v_token;

  i := 1;
  while i <= array_length(v_users, 1) loop
    v_batch := v_users[i : i + 24];
    i := i + 25;
    begin
      select content into v_body from extensions.http_post(
        v_url,
        jsonb_build_object('profiles', to_jsonb(v_batch),
                           'resultsPerPage', 1,
                           'shouldDownloadVideos', false,
                           'shouldDownloadCovers', false,
                           'shouldDownloadSubtitles', false)::text,
        'application/json');
      v_json := v_body::jsonb;
    exception when others then
      raise notice 'refresh_tiktok batch failed: %', sqlerrm; continue;
    end;

    for e in select jsonb_array_elements(v_json) loop
      m := e->'authorMeta';
      if m is null then continue; end if;
      v_user := lower(coalesce(m->>'name', m->>'nickName'));
      v_foll := nullif(m->>'fans', '')::bigint;
      if v_user is null or coalesce(v_foll, 0) = 0 then continue; end if;
      v_hearts := coalesce(nullif(m->>'heart', '')::numeric, 0);
      v_videos := greatest(coalesce(nullif(m->>'video', '')::numeric, 1), 1);
      v_er := case when v_foll > 0 and v_hearts > 0
                   then round(least(100, v_hearts / v_videos / v_foll * 100), 2) else 0 end;
      v_avatar := coalesce(m->>'avatar', m->>'originalAvatarUrl');

      for v_inf in
        select influencer_id from public.social_platforms
         where platform = 'tiktok' and lower(replace(username, '@', '')) = v_user
      loop
        update public.social_platforms
           set followers_count = v_foll, engagement_rate = nullif(v_er, 0)
         where platform = 'tiktok' and influencer_id = v_inf;
        insert into public.influencer_analytics_history
          (influencer_id, platform, followers_count, engagement_rate)
          values (v_inf, 'tiktok', v_foll, nullif(v_er, 0));
        if v_avatar is not null then
          update public.influencer_profiles set avatar_url = v_avatar where id = v_inf;
        end if;
        n := n + 1;
      end loop;
    end loop;
  end loop;
  return n;
end;
$$;

-- ── YouTube (Data API, per handle) ───────────────────────────────────────────
create or replace function private.refresh_youtube()
returns integer
language plpgsql
security definer
set search_path = private, public, extensions
as $$
declare
  v_key text := private.setting('youtube_api_key');
  r     record;
  v_body text;
  j     jsonb;
  st    jsonb;
  v_foll bigint;
  v_er   numeric;
  v_avatar text;
  n     int := 0;
begin
  if v_key is null then raise notice 'refresh_youtube: no youtube_api_key'; return 0; end if;
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  set local statement_timeout = 0;

  for r in
    select influencer_id, replace(username, '@', '') as handle
      from public.social_platforms where platform = 'youtube' and username is not null
  loop
    begin
      select content into v_body from extensions.http_get(
        'https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&forHandle='
        || r.handle || '&key=' || v_key);
      j := v_body::jsonb;
    exception when others then
      raise notice 'refresh_youtube % failed: %', r.handle, sqlerrm; continue;
    end;

    st := j->'items'->0->'statistics';
    if st is null then continue; end if;
    v_foll := nullif(st->>'subscriberCount', '')::bigint;
    if coalesce(v_foll, 0) = 0 then continue; end if;
    v_er := case when v_foll > 0
                 then round(least(100, (st->>'viewCount')::numeric
                            / greatest((st->>'videoCount')::numeric, 1) / v_foll * 100), 2)
                 else 0 end;
    v_avatar := coalesce(j->'items'->0->'snippet'->'thumbnails'->'high'->>'url',
                         j->'items'->0->'snippet'->'thumbnails'->'default'->>'url');

    update public.social_platforms
       set followers_count = v_foll, engagement_rate = nullif(v_er, 0)
     where platform = 'youtube' and influencer_id = r.influencer_id;
    insert into public.influencer_analytics_history
      (influencer_id, platform, followers_count, engagement_rate)
      values (r.influencer_id, 'youtube', v_foll, nullif(v_er, 0));
    if v_avatar is not null then
      update public.influencer_profiles set avatar_url = v_avatar where id = r.influencer_id;
    end if;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- ── orchestrator: refresh all, set profile ER from primary, re-rank league ───
create or replace function private.refresh_social_stats()
returns void
language plpgsql
security definer
set search_path = private, public
as $$
begin
  -- call order = avatar priority (YouTube < TikTok < Instagram; last writer wins)
  perform private.refresh_youtube();
  perform private.refresh_tiktok();
  perform private.refresh_instagram();

  update public.influencer_profiles ip
     set engagement_rate = sp.engagement_rate
    from public.social_platforms sp
   where sp.influencer_id = ip.id and sp.is_primary = true and sp.engagement_rate is not null;

  with totals as (
    select ip.id, coalesce(sum(sp.followers_count), 0) total
      from public.influencer_profiles ip
      left join public.social_platforms sp on sp.influencer_id = ip.id
     where ip.is_visible = true
     group by ip.id
  ), ranked as (
    select id, row_number() over (order by total desc) rn from totals
  )
  update public.influencer_profiles ip set league_rank = ranked.rn
    from ranked where ranked.id = ip.id;
end;
$$;

-- ── reschedule: drop the 008 worker jobs, run the in-DB refresh daily ────────
do $$ begin perform cron.unschedule('enqueue-bloggers-daily'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('drain-scraping-queue');   exception when others then null; end $$;
do $$ begin perform cron.unschedule('refresh-social-stats');   exception when others then null; end $$;

select cron.schedule('refresh-social-stats', '0 3 * * *', $$ select private.refresh_social_stats(); $$);
