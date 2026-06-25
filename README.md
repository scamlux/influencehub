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
- **Payments:** Stripe (primary) + PayMe (Uzbekistan).
- **i18n:** custom in-memory EN/UZ.

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

2. Deploy the edge functions:

   ```bash
   supabase functions deploy process-subscription stripe-webhook \
     onboard-influencer claim-influencer fetch-social-stats \
     process-scraping-queue send-magic-link discover-influencers
   ```

   `stripe-webhook` must be registered with `verify_jwt = false` (Stripe sends
   no Supabase JWT) — see the note in `functions/stripe-webhook/index.ts`.

3. Copy `frontend/.env.example` → `frontend/.env` and fill in
   `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`.

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
the in-memory mock layer, so they need no backend.

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