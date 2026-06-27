#!/bin/sh
# Run all discovery jobs once. Reads config from env. Telegram + Apify fall back
# to the baked UZ starter lists when TG_CHANNELS / IG_USERS / TT_USERS are unset.
# Each job's outcome is collected and handed to healthcheck.mjs, which records a
# discovery_runs row and pings Slack (SLACK_WEBHOOK_URL) on any failure.
cd "$(dirname "$0")"
ts() { date -u +%FT%TZ; }
STARTED=$(ts)
echo "[$STARTED] ── discovery refresh start ──"

# job <name> <cmd...> : run a job, print + remember its status (ok|failed).
JOBS=""
job() {
  name=$1
  shift
  if "$@"; then
    echo "[$(ts)] $name ok"
    JOBS="$JOBS --job=$name:ok"
  else
    echo "[$(ts)] $name failed"
    JOBS="$JOBS --job=$name:failed"
  fi
}

job youtube node discover-influencers.mjs --regions="${REGIONS:-UZ}" --max="${YT_MAX:-150}"

if [ -n "${TG_CHANNELS:-}" ]; then
  job telegram node discover-telegram.mjs --channels="$TG_CHANNELS"
else
  job telegram node discover-telegram.mjs
fi

if [ -n "${APIFY_API_KEY:-}" ]; then
  if [ -n "${IG_USERS:-}" ]; then
    job instagram node discover-apify.mjs --platform=instagram --users="$IG_USERS"
  else
    job instagram node discover-apify.mjs --platform=instagram
  fi
  if [ -n "${TT_USERS:-}" ]; then
    job tiktok node discover-apify.mjs --platform=tiktok --users="$TT_USERS"
  else
    job tiktok node discover-apify.mjs --platform=tiktok
  fi
else
  echo "[$(ts)] APIFY_API_KEY not set — skipping Instagram/TikTok"
  JOBS="$JOBS --job=instagram:skipped --job=tiktok:skipped"
fi

echo "[$(ts)] ── discovery refresh done ──"

# Heartbeat + alert. Never fails the run.
node healthcheck.mjs --started="$STARTED" $JOBS || true
