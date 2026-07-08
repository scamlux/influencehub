# Architecture — InfluenceHub

InfluenceHub is an influencer-marketplace SaaS: brands post campaigns, influencers
bid, the two chat and strike deals, money is held in **escrow**, and the platform
takes a **12 % commission** on release. This document describes how the system is
put together and how it ships.

- **Live site:** deployed on Vercel (SPA)
- **Backend:** Supabase (PostgreSQL + Deno Edge Functions)
- **Repo:** monorepo, `npm` workspaces

---

## 1. Repository layout

```
famic/
├── frontend/              # React 18 + Vite SPA  → Vercel
│   ├── src/
│   │   ├── lib/api.ts     # SINGLE data-access layer (mock + Supabase branches)
│   │   ├── lib/           # i18n, deal-status machine, plans/escrow, sentry, motion
│   │   ├── hooks/         # useMessages (realtime chat), …
│   │   ├── components/    # shadcn/ui + feature components (chat, campaign, ui)
│   │   └── pages/         # brand / influencer / admin / shared routes
│   ├── e2e/               # Playwright smoke specs (run in mock mode)
│   └── vercel.json        # SPA rewrite + security headers
├── backend/supabase/
│   ├── migrations/        # 001 → 020, ordered, idempotent, RLS in-file
│   ├── functions/         # Deno edge functions
│   │   ├── _shared/       # cors, client, fulfill, rate-limit, uz
│   │   ├── payme-webhook/ # + core.ts (protocol) + core_test.ts
│   │   ├── click-webhook/
│   │   ├── fund-deal/     # escrow funding entrypoint
│   │   ├── release-deal/  # escrow release + payout
│   │   └── stripe-webhook/, …
│   └── config.toml        # per-function verify_jwt flags
├── vercel.json            # root build config (outputDirectory: frontend/dist)
└── .github/workflows/ci.yml
```

---

## 2. Frontend

| Concern | Choice |
|---|---|
| Framework | **React 18.3 + TypeScript**, bundled with **Vite** (`tsc -b && vite build`) |
| UI kit | **Tailwind CSS + shadcn/ui** on top of Radix UI primitives |
| Icons | lucide-react |
| Animation | **motion** (v12) only — `usePrefersReducedMotion` for accessibility |
| Forms | react-hook-form + `@hookform/resolvers` |
| Data client | `@supabase/supabase-js` |
| Realtime | Supabase Realtime (`postgres_changes` + broadcast) |
| Payments (client) | `@stripe/stripe-js` |
| Monitoring | `@sentry/react` (opt-in via `VITE_SENTRY_DSN`) |
| i18n | hand-rolled flat dictionaries — **en / uz / ru** |

### Data-access rule

**All** data flows through `frontend/src/lib/api.ts`. Pages and components never
import `mockDB` or call Supabase directly. `api.ts` implements *two branches* for
every operation:

- **Supabase branch** — real `supabase-js` calls, used when a URL + anon key are present.
- **Mock branch** — an in-memory `mockDB` persisted to `localStorage`, with an
  in-memory event bus that mimics Supabase Realtime channels.

```
USE_MOCK_DATA = VITE_USE_MOCK_DATA === "true" || !url || !anonKey
```

Mock mode makes the **entire product runnable with no backend** — this is what
Playwright E2E and local demos run against.

### Realtime chat & notifications

- `useMessages` does optimistic send (temp message → replaced by the real row),
  typing indicators via refcounted broadcast channels, and unread clearing.
- Cross-user notifications are delivered by a `SECURITY DEFINER` trigger
  (`notify_message_received`, migration `018`) so a message insert notifies the
  chat counterpart across the RLS boundary.

---

## 3. Backend (Supabase)

### Database

PostgreSQL with **20 ordered migrations** (`001` → `020`). Each migration:

- is **idempotent** (`if not exists` / `on conflict`), so the schema applies from
  scratch in order (`supabase db reset`);
- ships its **RLS policies in the same file** — row-level security is the primary
  authorization boundary.

Key later migrations:

| Migration | Adds |
|---|---|
| `018_message_notifications` | trigger that notifies the chat counterpart on message insert |
| `019_uz_payment_providers` | `payme_transactions`, `click_transactions`; `payments.provider/provider_ref/deal_id` |
| `020_escrow` | `deal_payments` (escrow ledger), `payouts` (settlement queue); relaxed deal-status check |

### Edge Functions (Deno)

Shared helpers live in `functions/_shared/` (`cors`, `client`, `fulfill`,
`rate-limit`, `uz`). Each function reuses `getUser` / `adminClient` and CORS
handling from there.

Payment **protocol logic** is isolated in runtime-agnostic `core.ts` files (no
Deno/network imports) so it is **unit-tested with `deno test`** without touching a
database. The Supabase-backed store is injected at the edges (`index.ts`).

---

## 4. Payments & escrow

### Money handling rules

- **Integer minor units only** — cents (USD) / tiyin (UZS). No floats anywhere in
  the money path.
- **Platform fee = 12 %**, snapshotted per payment (`splitEscrow` → `{ feeCents, payoutCents }`).
- **Idempotency** keyed by provider transaction id; webhooks tolerate provider retries.

### Providers

| Provider | Function | `verify_jwt` | Authentication |
|---|---|---|---|
| **Payme** (JSON-RPC Merchant API) | `payme-webhook` | `false` | Basic `Paycom:<merchant key>` header |
| **Click** (SHOPAPI) | `click-webhook` | `false` | md5 `sign` verification |
| **Stripe** | `stripe-webhook` | `false` | Stripe signature |
| Escrow funding | `fund-deal` | `true` | must be the deal's brand + rate-limit |
| Escrow release / payout | `release-deal` | `true` | brand approve or admin resolve + rate-limit |

Payment webhooks are `verify_jwt = false` (the gateway calls them directly) and
instead verify a **provider signature** on every request. Subscription and escrow
orders are fulfilled through one shared `_shared/fulfill.ts`, so all providers
behave identically.

**Payme** implements the full Merchant API state machine in `core.ts`:
`CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`,
`CancelTransaction`, `CheckTransaction`, with spec transaction states
(`1` created, `2` performed, `-1` / `-2` cancelled) and amounts in tiyin.

### Escrow lifecycle

```
pending ──fund──▶ funded ──start──▶ in_progress ──deliver──▶ delivered ──release──▶ released
   │                                                              │
   └───────────────────── dispute / refund ───────────────────────┘
```

The status machine is a **pure, unit-tested module**
(`frontend/src/lib/deal-status.ts`): canonical steps, role-gated transitions,
legacy-status mapping, and terminal/dispute handling. Releasing an escrow payment
marks `deal_payments.status = released` and enqueues a `payouts` row (status
`pending`) that admins settle manually from the Payments panel. A unique
constraint on `deal_payment_id` keeps payout inserts idempotent on retry.

---

## 5. Testing

| Layer | Tool | Scope |
|---|---|---|
| Unit (frontend) | **Vitest** | api functions, deal-status machine, i18n key parity, plans/escrow math |
| Protocol (edge) | **`deno test`** | Payme / Click protocol cores, rate-limiter |
| E2E | **Playwright** (chromium) | 5 smoke flows in **mock mode**, dedicated port 4321 |

> `deno check` on a function's `index.ts` fails locally because npm deps
> (`supabase-js` / `stripe`) need the import map Supabase injects at deploy — this
> is expected, not a regression. The protocol cores (which have no npm imports)
> pass `deno test`.

---

## 6. Deployment

### Frontend → Vercel

`vercel.json` builds the SPA and serves it with hardened headers:

- `framework: vite`, `buildCommand: npm run build`, `outputDirectory: frontend/dist`
- SPA rewrite: all paths → `/index.html`
- Security headers: **CSP** (whitelisting Supabase + Stripe origins), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
- Auto-deploys on push to `master`; PRs get Vercel preview deployments.

### Backend → Supabase

- Migrations applied in order via `supabase db reset` (or push).
- Functions deployed with `supabase functions serve` / deploy; `verify_jwt` per
  function from `config.toml`.
- Secrets (env): `PAYME_MERCHANT_KEY` / `PAYME_MERCHANT_TEST_KEY`,
  `CLICK_SERVICE_ID` / `CLICK_MERCHANT_ID` / `CLICK_SECRET`, `STRIPE_SECRET_KEY`,
  `UZS_PER_USD`, and the Supabase URL / keys.

### CI — GitHub Actions (`.github/workflows/ci.yml`)

Three jobs:

1. **build** — prettier check → eslint → typecheck → vitest → `vite build` (Node 20)
2. **functions** — `deno test backend/supabase/functions` (protocol cores)
3. **e2e** — Playwright chromium in mock mode; uploads the report as an artifact on failure

> ⚠️ **Known config gap:** the workflow triggers on `branches: [main]`, but the
> repo's default branch is `master`. Until the trigger is changed to `master`,
> Actions do not run automatically on PRs — builds are currently verified by
> Vercel's deployment and local runs. One-line fix.

---

## 7. Environment matrix

| Mode | How it runs | Backing store |
|---|---|---|
| **Mock** (`VITE_USE_MOCK_DATA=true`) | frontend only | in-memory `mockDB` + localStorage; realtime via event bus |
| **Full** | frontend + Supabase | PostgreSQL + edge functions; live payment sandboxes |

Every feature is implemented in **both** branches, so the app degrades gracefully
to a fully interactive demo when no backend is configured.
