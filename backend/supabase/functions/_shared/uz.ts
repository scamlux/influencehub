// Shared UZ payments config: plan pricing and the USD→UZS rate.
// Money is integer-only: USD cents for escrow bookkeeping, tiyin for
// providers (1 UZS = 100 tiyin).

export type PlanType = "brand_pro" | "influencer_sync" | "influencer_feature";

export const PLANS_USD: Record<
  PlanType,
  { amount: number; cadence: "month" | "day" }
> = {
  brand_pro: { amount: 29, cadence: "month" },
  influencer_sync: { amount: 5, cadence: "month" },
  influencer_feature: { amount: 10, cadence: "day" },
};

// Admin-updated constant; override per environment via the UZS_PER_USD secret
// (frontend mirrors it in src/lib/plans.ts — keep the two in sync).
export const DEFAULT_UZS_PER_USD = 12800;

export function uzsPerUsd(): number {
  const env = Number(Deno.env.get("UZS_PER_USD"));
  return Number.isFinite(env) && env > 0 ? env : DEFAULT_UZS_PER_USD;
}

/** Whole-USD → tiyin at the configured rate (rounded to whole UZS first). */
export function usdToTiyin(usd: number, rate = uzsPerUsd()): number {
  return Math.round(usd * rate) * 100;
}

export function planExpiry(plan: PlanType, from = new Date()): string {
  const d = new Date(from);
  if (PLANS_USD[plan].cadence === "day") d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

/** Platform take rate for escrow deals (T-14). Percent, integer math only. */
export const PLATFORM_FEE_PCT = 12;

export function splitEscrow(amountCents: number): {
  feeCents: number;
  payoutCents: number;
} {
  const feeCents = Math.round((amountCents * PLATFORM_FEE_PCT) / 100);
  return { feeCents, payoutCents: amountCents - feeCents };
}
