# Real blogger base — setup & daily refresh

The 25 demo/fake influencers were replaced with the **88 real CIS bloggers** from
`docs/CIS_Influencers_База.xlsx`, and their follower counts, engagement and
**avatars** are refreshed **daily, entirely inside Supabase** (pg_cron + the
`http` extension → Apify / YouTube). No external scheduler, CLI or edge-function
deploy is required.

## What ships

| File | Purpose |
| --- | --- |
| `backend/supabase/migrations/007_real_bloggers.sql` | Deletes the seeded fake influencers, inserts the 88 real bloggers (profiles + social platforms + contacts + initial analytics snapshot), recomputes `league_rank`. |
| `backend/supabase/migrations/008_daily_refresh.sql` | First-pass scheduler (private settings store + queue worker). Its cron jobs are superseded and unscheduled by 009; the `private.app_settings` table it creates is reused. |
| `backend/supabase/migrations/009_pgcron_apify_refresh.sql` | The live refresh: in-DB `refresh_instagram` / `refresh_tiktok` / `refresh_youtube` functions + the `refresh-social-stats` daily cron job. |
| `backend/scripts/refresh-stats.mjs` | The same logic as a standalone Node script — handy for an immediate backfill or debugging (`node backend/scripts/refresh-stats.mjs`). Not used by the schedule. |

## Providers

| Platform | Source | Data |
| --- | --- | --- |
| Instagram (78 rows) | Apify `apify~instagram-profile-scraper` | followers, engagement (from latest posts), avatar |
| TikTok (16 rows) | Apify `clockworks~tiktok-scraper` | followers, engagement (hearts/video), avatar |
| YouTube (5 rows) | YouTube Data API v3 | subscribers, engagement, avatar |

Avatars are written to `influencer_profiles.avatar_url` **every run** — Instagram
and TikTok CDN URLs are signed and expire, so the daily refresh keeps them live.
Priority when an influencer has several platforms: **Instagram > TikTok > YouTube**.
Any platform a provider can't return is left at its last known value (real
numbers are never overwritten with placeholders).

## Configuration (already applied to this project)

Provider keys live in `private.app_settings` — a schema that is **not** exposed
through PostgREST (the API serves only `public`), so the keys are unreachable
from the browser:

```sql
update private.app_settings set value = '<apify-token>'     where key = 'apify_token';
update private.app_settings set value = '<youtube-api-key>' where key = 'youtube_api_key';
```

## How the daily refresh works

`cron.schedule('refresh-social-stats', '0 3 * * *', 'select private.refresh_social_stats()')`:

1. `refresh_youtube()` → `refresh_tiktok()` → `refresh_instagram()` (call order =
   avatar priority). Each batches its usernames, calls the provider over the
   `http` extension, and writes fresh `social_platforms` numbers, an
   `influencer_analytics_history` row (drives the 30-day chart) and the avatar.
2. Profile `engagement_rate` is set from the primary platform.
3. The Blogger League is re-ranked by total followers.

Run it on demand from the SQL editor: `select private.refresh_social_stats();`
Change the cadence by editing the `cron.schedule(...)` call in `009`.

## Notes / known limits

- **YouTube handles** in the spreadsheet are mostly approximate — only
  `@zhekafatbelly` resolved to a real channel. Correct the `username` on those
  `social_platforms` rows to fix it; it affects 5 low-follower rows and does not
  change the league.
- A handful of Instagram/TikTok handles that are private/renamed keep their
  seeded spreadsheet numbers until the handle is corrected.

## Checks

```sql
select count(*) from influencer_profiles where user_id is null;          -- 88
select count(*) from influencer_profiles where avatar_url is not null;   -- avatars
select jobname, schedule, active from cron.job;                          -- refresh-social-stats
select display_name, league_rank from influencer_profiles order by league_rank limit 10;
```
