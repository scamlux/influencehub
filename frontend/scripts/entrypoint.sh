#!/bin/sh
# Two modes:
#   (default) run an internal cron scheduler (busybox crond) + tail the log
#   "once"    run all jobs once and exit (for a host crontab driving the container)
set -e
cd /app

# Cron jobs don't inherit the container env, so snapshot the relevant vars to a
# file the cron command sources.
write_env() {
  printenv \
    | grep -E '^(SUPABASE_|VITE_SUPABASE|YOUTUBE_|APIFY_|SLACK_WEBHOOK_URL|REGIONS|YT_MAX|TG_CHANNELS|IG_USERS|TT_USERS)=' \
    | sed 's/=\(.*\)$/="\1"/' > /app/cron.env || true
}

if [ "$1" = "once" ]; then
  exec /app/run-all.sh
fi

write_env
: > /var/log/cron.log
SCHEDULE="${CRON_SCHEDULE:-0 3 * * *}"
echo "$SCHEDULE . /app/cron.env; /app/run-all.sh >> /var/log/cron.log 2>&1" > /etc/crontabs/root
crond -b -l 8

if [ "${RUN_ON_START:-1}" = "1" ]; then
  ( . /app/cron.env; /app/run-all.sh >> /var/log/cron.log 2>&1 ) &
fi

echo "Discovery scheduler running (CRON_SCHEDULE='$SCHEDULE', UTC). Streaming log…"
exec tail -f /var/log/cron.log
