import type { PlanType, UserRole } from "@/types";

export interface PlanDef {
  plan: PlanType;
  name: string;
  price: string;
  cadence: string;
  audience: UserRole;
  tagline: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    plan: "brand_pro",
    name: "Brand Pro",
    price: "$29",
    cadence: "/month",
    audience: "brand",
    tagline: "Full marketplace access for brands",
    highlight: true,
    features: [
      "Full access to contacts, prices & discounts",
      "Advanced filters & search",
      "CSV export",
      "Unlimited campaigns & bids",
      "Side-by-side comparison",
    ],
  },
  {
    plan: "influencer_sync",
    name: "Influencer Sync",
    price: "$5",
    cadence: "/month",
    audience: "influencer",
    tagline: "Keep your stats fresh & rank higher",
    features: [
      "Daily auto-refresh of stats",
      "Higher league rank priority",
      "Growth trend charts",
      "Verified badge",
    ],
  },
  {
    plan: "influencer_feature",
    name: "Featured",
    price: "$10",
    cadence: "/day",
    audience: "influencer",
    tagline: "Get featured on the homepage",
    features: [
      "Featured card on homepage for 24h",
      "FIFO queue (up to 3 slots/day)",
      "Auto-expires after 24h",
      "Stackable with Influencer Sync",
    ],
  },
];
