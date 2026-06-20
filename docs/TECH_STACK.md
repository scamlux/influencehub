# Technology Choices & Justification

This document explains *why* each technology was chosen for InfluenceHub, with
the trade-offs considered. The headline architectural decision — **PostgreSQL
over MongoDB** — is covered first.

---

## Database: PostgreSQL (not MongoDB)

**Decision: PostgreSQL.**

InfluenceHub's data is **highly relational**. The domain is a graph of foreign
keys: a `deal` references a `bid`, a `campaign`, a `brand_profile` and an
`influencer_profile`; `messages` belong to `deals`; `bids` join `campaigns` to
`influencers`. Almost every screen is a *join* — "show me all bids on my
campaign with the bidding influencer's name and follower count."

| Criterion | PostgreSQL ✅ | MongoDB |
| --- | --- | --- |
| Relational integrity | Native FKs, `ON DELETE CASCADE`, `CHECK` constraints enforce the 20-table schema | App-level refs; no FK enforcement |
| Multi-entity joins | First-class SQL joins (league, bids, deals) | `$lookup` aggregations, slower & awkward |
| Row-level authorization | **Row Level Security** powers the entire access model (brand_pro gating, owner-only edits) | No equivalent; must hand-roll in app code |
| Realtime | Supabase Realtime streams Postgres WAL → chat & notifications for free | Change Streams exist but no Supabase integration |
| Transactions | Strong ACID for "accept bid → create deal → reject others" | Multi-doc txns exist but weaker ergonomics |
| Reporting / analytics | `influencer_analytics_history` time-series + window functions | Aggregation pipeline, less natural |

MongoDB shines for schema-less, denormalized, write-heavy document stores
(event logs, product catalogs). Here the schema is fixed and the relationships
are the product, so a relational database is the correct tool. The
business-critical rule "only `brand_pro` subscribers can read contacts/prices"
is expressed as **one RLS policy** in Postgres; in Mongo it would be scattered
across every query in application code and impossible to enforce at the data
layer.

---

## Backend platform: Supabase

Supabase = managed **PostgreSQL + Auth + Realtime + Storage + Edge Functions**
behind one project. Chosen because it collapses four services into one and lets
RLS be the single source of truth for authorization:

- **Auth** — email/password, Google OAuth, magic links out of the box; issues
  JWTs that `auth.uid()` reads inside RLS policies.
- **Realtime** — Postgres WAL streamed to the client; powers `deal-${id}` chat,
  `user-notifications`, and the admin `scraping-queue-admin` channel with zero
  socket code.
- **Edge Functions** (Deno) — the 6 server-side functions (Stripe/PayMe
  checkout, onboarding, scraping pipeline, magic link). Deno gives a secure,
  TypeScript-native runtime with Web-standard APIs.
- **Auto-injected secrets** — `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
  `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically, which is
  why our backend `.env` only needs `STRIPE_SECRET_KEY` (see *Minimal env*).

Alternative considered: a standalone **Node/Express + Prisma** API. Rejected
because it would force us to re-implement Auth, Realtime and row-level
authorization that Supabase provides natively — more code, more to secure.

---

## Frontend

| Tech | Why |
| --- | --- |
| **React 18** | Component model fits a dashboard-heavy app; huge ecosystem; concurrent features + `Suspense` enable route-level code splitting. |
| **TypeScript** | A 20-table relational schema is far safer with end-to-end types (`src/types`). Catches shape mismatches at compile time. |
| **Vite** | Instant HMR, native ESM, fast prod builds; first-class code-splitting (we ship one chunk per route). |
| **React Router v6** | Nested layout routes map cleanly to `/brand/*`, `/influencer/*`, `/admin/*` with a single `RoleGuard` per section. |
| **Tailwind + shadcn/ui** | Utility CSS keeps styling colocated; shadcn gives accessible Radix primitives we own and can theme to the exact pink (`hsl(330 100% 60%)`) brand. |
| **React Hook Form + Zod** | Uncontrolled inputs = minimal re-renders; Zod schemas double as the TS types and runtime validation for every form. |
| **Recharts** | Declarative charts for the 30-day follower-growth history; lazy-loaded so its ~390 KB never hits the initial load. |
| **Lucide** | Tree-shakeable icon set; only used glyphs ship (each becomes its own tiny chunk). |

---

## Payments: Stripe (primary) + PayMe (secondary)

Stripe is the global standard for subscription billing (Checkout, webhooks,
recurring intervals) — used for `brand_pro` ($29/mo), `influencer_sync` ($5/mo)
and the daily `influencer_feature` ($10/day). PayMe is included as the dominant
local processor for the Uzbekistan market. Checkout is created by one edge
function (`process-subscription`) so the UI calls a single endpoint, and a second
function (`stripe-webhook`) verifies the `checkout.session.completed` signature
and actually grants the plan. Both fall back to a mock activation path when no
keys are configured.

---

## Internationalization: custom in-memory i18n

A tiny `t(key)` lookup over an in-memory EN/UZ object (`src/lib/i18n.ts`) with a
`useLanguage()` hook and `localStorage` persistence. For two languages and a
fixed key set this beats pulling in `i18next` + HTTP backends — zero deps, zero
async loading, fully typed keys.

---

## Performance refactor (this pass)

- **Route-level code splitting** — every page is `React.lazy()`-loaded behind a
  `<Suspense>` boundary, so a brand never downloads admin/influencer code.
- **Vendor chunking** — `react`, `recharts` and `@supabase/supabase-js` split
  into separate long-cacheable chunks via `build.rollupOptions.manualChunks`.
- **Result** — the initial bundle dropped from a single **964 KB** file to a
  **~185 KB** entry chunk, with Recharts (~390 KB) loaded only on chart pages.

---

## Minimal environment footprint

Env was deliberately reduced to the essentials:

- **Frontend** reads exactly **2** required vars (`VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`) — and *zero* to run in mock mode. Stripe key and a
  mock-mode override are optional/commented.
- **Backend** declares **2** Stripe secrets (`STRIPE_SECRET_KEY` for creating a
  Checkout Session in `process-subscription`, and `STRIPE_WEBHOOK_SECRET` for
  verifying the `checkout.session.completed` event in `stripe-webhook`); the
  three `SUPABASE_*` values are auto-injected by the platform. PayMe / YouTube /
  discovery keys are optional and only needed to leave mock mode for those
  integrations.

Unused variables from the original spec (`INSTAGRAM/TIKTOK_API_KEY`) were removed
because no code path reads them.
