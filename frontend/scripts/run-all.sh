#!/bin/sh
# Run all discovery jobs once. Reads config from env. Telegram + Apify fall back
# to the baked UZ starter lists when TG_CHANNELS / IG_USERS / TT_USERS are unset.
cd "$(dirname "$0")"
ts() { date -u +%FT%TZ; }
echo "[$(ts)] ── discovery refresh start ──"

node discover-influencers.mjs --regions="${REGIONS:-UZ}" --max="${YT_MAX:-150}" \
  || echo "[$(ts)] youtube failed"

node discover-telegram.mjs ${TG_CHANNELS:+--channels="$TG_CHANNELS"} \
  || echo "[$(ts)] telegram failed"

if [ -n "${APIFY_API_KEY:-}" ]; then
  node discover-apify.mjs --platform=instagram ${IG_USERS:+--users="$IG_USERS"} \
    || echo "[$(ts)] instagram failed"
  node discover-apify.mjs --platform=tiktok ${TT_USERS:+--users="$TT_USERS"} \
    || echo "[$(ts)] tiktok failed"
else
  echo "[$(ts)] APIFY_API_KEY not set — skipping Instagram/TikTok"
fi

echo "[$(ts)] ── discovery refresh done ──"
