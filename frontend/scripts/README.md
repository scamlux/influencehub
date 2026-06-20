# Discovery worker (scheduled refresh)

Keeps the league's real-data bloggers fresh by running the discovery scripts on a
schedule. Three sources:

| Script                     | Source                                 | Cost     |
| -------------------------- | -------------------------------------- | -------- |
| `discover-influencers.mjs` | YouTube Data API (multi-region search) | free     |
| `discover-telegram.mjs`    | scrape `t.me/s/<channel>`              | free     |
| `discover-apify.mjs`       | Apify Instagram/TikTok actors          | **paid** |

Telegram + Apify fall back to the curated lists in `uz-starter.mjs` unless you
pass `TG_CHANNELS` / `IG_USERS` / `TT_USERS`.

## Run on a server (Docker Compose)

```bash
cd frontend/scripts
cp .env.example .env          # fill in keys (SERVICE ROLE key is secret)
docker compose up -d --build  # internal cron: daily 03:00 UTC, runs once on start
docker compose logs -f        # watch refreshes
```

Change cadence with `CRON_SCHEDULE` in `.env` (busybox cron expression, UTC),
regions with `REGIONS=UZ,KZ,RU`, and set `RUN_ON_START=0` to skip the immediate run.

## One-shot (run all jobs once, then exit)

```bash
docker compose run --rm refresh once
```

## Drive it from the host crontab instead

If you'd rather schedule with the host's cron (and not keep a container running):

```cron
# crontab -e  → daily at 03:00
0 3 * * *  cd /path/to/frontend/scripts && docker compose run --rm refresh once >> /var/log/influencehub-refresh.log 2>&1
```

## Run locally without Docker

```bash
cd frontend/scripts
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... YOUTUBE_DATA_API_KEY=... \
  REGIONS=UZ ./run-all.sh
```

(Resolves `@supabase/supabase-js` from the parent `frontend/node_modules`.)

## Notes

- The **service-role key** grants full DB access — store it only in `.env`
  (gitignored) or your orchestrator's secrets, never in git.
- A failing source doesn't abort the others (each job is independent).
- All jobs are **idempotent**: they dedupe by profile URL and refresh stats +
  re-rank, so re-running is safe.
