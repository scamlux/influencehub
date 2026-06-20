import { loadStripe, type Stripe } from "@stripe/stripe-js";
import type { PlanType } from "@/types";

const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(publishableKey);
  return stripePromise;
}

export const PLAN_PRICING: Record<
  PlanType,
  { label: string; price: number; cadence: string; priceLabel: string }
> = {
  brand_pro: { label: "Brand Pro", price: 29, cadence: "month", priceLabel: "$29/month" },
  influencer_sync: {
    label: "Influencer Sync",
    price: 5,
    cadence: "month",
    priceLabel: "$5/month",
  },
  influencer_feature: {
    label: "Featured",
    price: 10,
    cadence: "day",
    priceLabel: "$10/day",
  },
};
