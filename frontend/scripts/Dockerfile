# Scheduled blogger-discovery worker (YouTube / Telegram / Apify).
FROM node:20-alpine

WORKDIR /app

# Install only the Supabase SDK (busybox crond ships with alpine).
COPY package.json ./
RUN npm install --omit=dev

# Discovery scripts + curated starter lists + runners.
COPY *.mjs ./
COPY run-all.sh entrypoint.sh ./
RUN chmod +x run-all.sh entrypoint.sh && mkdir -p /var/log

# Default: internal cron scheduler. Use `... once` for a one-shot run.
ENTRYPOINT ["/app/entrypoint.sh"]
