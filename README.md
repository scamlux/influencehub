# InfluenceHub

A full-stack **Influencer Marketplace SaaS**. Brands discover Uzbek creators in
a ranked "Blogger League", subscribe for full contact/pricing access, run
campaigns, collect bids, and manage deals with real-time chat. Influencers
onboard their socials, set ad prices, publish discounts, and bid on campaigns.

## Monorepo layout

```text
famic/
├── frontend/        # React 18 + TypeScript + Vite single-page app
│   ├── src/
│   └── .env.example # 2 vars (mock mode needs none)
├── backend/         # Supabase project (PostgreSQL + Edge Functions)
│   ├── supabase/
│   │   ├── migrations/   # 001 schema · 002 RLS · 003 seed · 004 realtime
│   │   │                 #   · 005 admin subs · 006 country
│   │   └── functions/    # 8 Deno edge functions
│   └── .env.example # Stripe secrets (Supabase auto-injects the rest)
├── docs/
│   └── TECH_STACK.md     # why each technology was chosen (PostgreSQL vs Mongo)
└── package.json     # workspace root with convenience scripts
```

## Tech stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind + shadcn/ui, React Router v6,
  React Hook Form + Zod, Recharts, Lucide.
- **Backend:** Supabase — **PostgreSQL**, Auth, Realtime, Storage, Edge Functions (Deno).
- **Payments:** Stripe (cards) + **Payme Merchant API** & **Click SHOPAPI** (Uzbekistan, in tiyin).
- **Escrow:** deals funded into escrow, 12% platform fee, released to a payout queue.
- **i18n:** custom in-memory **EN / UZ / RU**.
- **Monitoring:** optional Sentry (frontend) + per-instance rate limiting on edge functions.

See [`docs/TECH_STACK.md`](docs/TECH_STACK.md) for the full justification,
including why **PostgreSQL** was chosen over MongoDB.

## Quick start (mock mode — no backend needed)

```bash
npm install            # installs the frontend workspace
npm run dev            # http://localhost:5173
```

With no Supabase env vars set, the whole app runs against the in-memory seed
layer in `frontend/src/lib/mock-data.ts` — every page is browsable offline.

## Connecting a real Supabase backend

1. Run the migrations in order (from `backend/`):

   ```bash
   supabase db reset            # applies 001 → 002 → 003
   ```

   - `001_schema.sql` — tables, indexes, triggers, RLS helper functions
   - `002_rls_policies.sql` — Row Level Security policies
   - `003_seed_data.sql` — 3 admins, 5 brands, 25 influencers + demo data
     (every seeded user's password is `Password123!`)
   - `004_realtime.sql` — realtime publication + notification triggers
   - `005_admin_subscriptions.sql` — admin update policy for subscriptions
   - `006_country.sql` — `country` column on influencer profiles
   - `007_real_bloggers.sql` — removes the seeded fakes and loads the real CIS
     blogger base (`docs/CIS_Influencers_База.xlsx`); see
     [`docs/REAL_BLOGGERS_SETUP.md`](docs/REAL_BLOGGERS_SETUP.md)
   - `008_daily_refresh.sql` — pg_cron settings store + first-pass worker
   - `009_pgcron_apify_refresh.sql` — in-DB daily refresh of followers,
     engagement & avatars (Apify + YouTube via the `http` extension)
   - `010`–`017` — audit-log triggers, demo/test accounts, avatar storage &
     caching, league cleanup, discovery heartbeat, display-name latinization
   - `018_message_notifications.sql` — notify the chat counterpart on new
     messages (one unread notification per chat)
   - `019_uz_payment_providers.sql` — `payme_transactions`, `click_transactions`,
     `payments.provider/provider_ref/deal_id`
   - `020_escrow.sql` — `deal_payments` (held → released → refunded → paid_out)
     and `payouts` queue, integer USD cents only, RLS scoped to deal parties

2. Deploy the edge functions:

   ```bash
   supabase functions deploy process-subscription stripe-webhook \
     onboard-influencer claim-influencer fetch-social-stats \
     process-scraping-queue send-magic-link discover-influencers \
     payme-webhook click-webhook fund-deal release-deal
   ```

   Payment webhooks (`stripe-webhook`, `payme-webhook`, `click-webhook`) are
   registered with `verify_jwt = false` — the gateways send no Supabase JWT and
   authenticate by provider signature instead (Stripe signature / Basic
   `Paycom:<key>` / Click md5). `fund-deal` and `release-deal` require a JWT.

3. Copy `frontend/.env.example` → `frontend/.env` and fill in
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (optional `VITE_SENTRY_DSN`).
   Backend secrets go in `backend/.env` (see `backend/.env.example`):
   `supabase secrets set --env-file backend/.env`.

   | Secret | Function | Purpose |
   | ------ | -------- | ------- |
   | `PAYME_MERCHANT_KEY` / `PAYME_MERCHANT_TEST_KEY` | payme-webhook | prod / sandbox Basic-auth keys |
   | `CLICK_SERVICE_ID` / `CLICK_MERCHANT_ID` / `CLICK_SECRET_KEY` | click-webhook | Click SHOPAPI |
   | `UZS_PER_USD` | shared | USD→UZS rate for pricing in tiyin (default 12800) |
   | `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | stripe-webhook, fund-deal | card payments |

## Payments & escrow

Subscriptions and deal funding share one order model (`_shared/fulfill.ts`).
Providers verify their own protocol, then delegate the business effect:

- **Payme** (`payme-webhook`) — full Merchant API JSON-RPC:
  `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`,
  `CancelTransaction`, `CheckTransaction`; transaction states `1/2/-1/-2`;
  idempotent perform/cancel. **Sandbox:** set only `PAYME_MERCHANT_TEST_KEY`
  and point the `test.paycom.uz` cabinet at the function URL.
- **Click** (`click-webhook`) — SHOPAPI Prepare/Complete with md5 sign check.
- **Escrow flow:** deal is created `pending` → brand funds via `fund-deal`
  (money `held`, 12% platform fee snapshotted) → influencer `start`/`deliver`
  → brand `release` (or admin resolves a dispute) → `payouts` row enqueued →
  admin marks it paid from the **Payments** panel (`paid_out`). Money is
  integer USD cents throughout — no floats. The whole flow is demoable in mock
  mode (funding is simulated locally).

Protocol logic is isolated in each function's `core.ts` and unit-tested:

```bash
deno test backend/supabase/functions   # Payme (8) + Click (6) + rate-limit (3)
```

## Scripts (run from repo root)

- `npm run dev` — frontend dev server
- `npm run build` — typecheck + production build (code-split bundles)
- `npm run preview` — preview the production build
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (TypeScript + react-hooks + react-refresh)
- `npm run format` — Prettier write (`format:check` for CI)
- `npm run test` — Vitest unit suite (data layer + helpers)
- `npm run db:reset` — reset/seed the Supabase database
- `npm run functions:serve` — serve edge functions locally

## Quality gates

Every push / PR runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml):
Prettier check → ESLint → typecheck → tests → build. Run the same locally with:

```bash
npm run format:check && npm run lint && npm run typecheck && npm run test && npm run build
```

Tests live next to the code they cover (`frontend/src/**/*.test.ts`) and run on
the in-memory mock layer, so they need no backend. Payment/escrow protocol
cores are tested with Deno (`deno test backend/supabase/functions`).

**End-to-end (Playwright):** 5 smoke scenarios (brand registration, subscription,
campaign creation, influencer bid, chat) run against mock mode — no backend
needed:

```bash
cd frontend && npm run e2e        # headless; e2e:ui for the inspector
```

CI runs them in a dedicated job after the unit build.

## Production checklist

- [x] Rate limiting on edge functions (`_shared/rate-limit.ts`, per-instance
      fixed window) — applied to payment webhooks and fund/release.
- [x] Payment webhook signature verification + idempotency by transaction id.
- [x] Sentry-ready error reporting (`VITE_SENTRY_DSN`).
- [x] E2E smoke suite green in CI.
- [ ] Enable Supabase **PITR** backups (Point-in-Time Recovery) on the project.
- [ ] Point a custom domain + set `VITE_*` production env in the host.
- [ ] Add product analytics (PostHog / Plausible) snippet.
- [ ] PII retention policy for `influencer_contacts` (scrub on request).

## Deployment

The frontend is a static SPA — deploy `frontend/` to any static host.

**Vercel:** import the repo, set the project root to `frontend/`. The included
[`frontend/vercel.json`](frontend/vercel.json) sets the Vite framework preset and
rewrites all routes to `index.html` so client-side deep links (e.g.
`/brand/league`) resolve. Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` as
environment variables (omit them to ship the mock-mode demo).

Backend (Supabase) is deployed separately via the migrations + `functions deploy`
steps above.


Для анимаций используем библиотеку motion (motion/react), а не CSS-переходы