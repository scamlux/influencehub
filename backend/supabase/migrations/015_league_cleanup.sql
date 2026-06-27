-- ============================================================================
-- InfluenceHub — 015_league_cleanup.sql
-- Fixes three data-quality issues surfaced by league QA:
--
--   #4  Duplicate bloggers — the same person seeded twice (e.g. a Latin and a
--       Cyrillic spelling sharing one Instagram account). We keep the strongest
--       row and hide the rest (is_visible = false — reversible, not deleted).
--   #13 Russian "About" text — early seeds stored the raw Russian niche label
--       (category_raw) in `bio`, which reads wrong in the English UI. We replace
--       any Cyrillic bio with a clean English line derived from category + country.
--   #1  Missing rank position — once duplicates are hidden, league_rank is
--       recomputed as a contiguous 1..N over visible profiles (no gaps).
--
-- Idempotent: hiding duplicates and rewriting Cyrillic bios are both no-ops on a
-- second run, and the rank recompute is deterministic.
-- ============================================================================

-- ── #4. de-duplicate by shared Instagram account ─────────────────────────────
-- Group visible profiles by their (normalized) Instagram username; within each
-- group keep the row with the most total followers (ties → earliest created),
-- hide the others.
with ig as (
  select sp.influencer_id,
         lower(trim(coalesce(sp.username, sp.profile_url))) as handle
    from public.social_platforms sp
   where sp.platform = 'instagram'
     and coalesce(sp.username, sp.profile_url) is not null
),
totals as (
  select ip.id,
         ig.handle,
         coalesce(sum(sp.followers_count), 0) as followers,
         ip.created_at
    from public.influencer_profiles ip
    join ig on ig.influencer_id = ip.id
    left join public.social_platforms sp on sp.influencer_id = ip.id
   where ip.is_visible = true
     and ip.user_id is null            -- never touch a claimed/login-backed profile
   group by ip.id, ig.handle, ip.created_at
),
ranked as (
  select id, handle,
         row_number() over (
           partition by handle
           order by followers desc, created_at asc, id asc
         ) as rn,
         count(*) over (partition by handle) as dupes
    from totals
)
update public.influencer_profiles ip
   set is_visible = false
  from ranked
 where ranked.id = ip.id
   and ranked.rn > 1          -- keep rn = 1, hide the rest
   and ranked.dupes > 1;

-- ── #13. replace Russian category_raw bios with English ──────────────────────
update public.influencer_profiles ip
   set bio = initcap(coalesce(ip.category, 'content')) || ' creator'
             || coalesce(
                  ' from ' || (case ip.country
                    when 'UZ' then 'Uzbekistan'
                    when 'KZ' then 'Kazakhstan'
                    when 'KG' then 'Kyrgyzstan'
                    when 'TJ' then 'Tajikistan'
                    when 'TM' then 'Turkmenistan'
                    when 'RU' then 'Russia'
                    else null end),
                  '')
             || '.'
 where ip.bio ~ '[А-Яа-яЁё]';   -- only rows whose About still contains Cyrillic

-- ── #1. recompute contiguous league_rank by total followers ──────────────────
with totals as (
  select ip.id,
         coalesce(sum(sp.followers_count), 0) as total
    from public.influencer_profiles ip
    left join public.social_platforms sp on sp.influencer_id = ip.id
   where ip.is_visible = true
   group by ip.id
),
ranked as (
  select id, row_number() over (order by total desc, id asc) as rn from totals
)
update public.influencer_profiles ip
   set league_rank = ranked.rn
  from ranked
 where ranked.id = ip.id;

-- Hidden profiles shouldn't keep a stale rank that could resurface in admin views.
update public.influencer_profiles
   set league_rank = null
 where is_visible = false;
