import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const BASE = "InfluenceHub";

// Ordered longest-prefix-first so specific routes win over their parents.
const TITLES: { match: (path: string) => boolean; title: string }[] = [
  { match: (p) => p === "/", title: "Influencer Marketplace" },
  { match: (p) => p.startsWith("/league"), title: "Blogger League" },
  { match: (p) => p.startsWith("/pricing"), title: "Pricing" },
  { match: (p) => p.startsWith("/blogger/"), title: "Blogger Profile" },
  { match: (p) => p.startsWith("/login"), title: "Sign In" },
  { match: (p) => p.startsWith("/register"), title: "Create Account" },
  { match: (p) => p.startsWith("/forgot-password"), title: "Reset Password" },
  { match: (p) => p.startsWith("/reset-password"), title: "Reset Password" },
  { match: (p) => p.startsWith("/choose-role"), title: "Choose Role" },
  { match: (p) => p.startsWith("/forbidden"), title: "Access Denied" },
  { match: (p) => p.startsWith("/terms"), title: "Terms of Service" },
  { match: (p) => p.startsWith("/privacy"), title: "Privacy Policy" },

  // brand
  { match: (p) => p.startsWith("/brand/league"), title: "Blogger League" },
  { match: (p) => p.startsWith("/brand/bloggers/"), title: "Blogger Profile" },
  { match: (p) => p.startsWith("/brand/campaigns/new"), title: "New Campaign" },
  { match: (p) => p.startsWith("/brand/campaigns"), title: "Campaigns" },
  { match: (p) => p.startsWith("/brand/deals"), title: "Deals" },
  { match: (p) => p.startsWith("/brand/chat"), title: "Chat" },
  { match: (p) => p.startsWith("/brand/compare"), title: "Compare" },
  { match: (p) => p.startsWith("/brand/favorites"), title: "Favorites" },
  { match: (p) => p.startsWith("/brand/settings"), title: "Settings" },
  { match: (p) => p.startsWith("/brand/subscription"), title: "Subscription" },
  { match: (p) => p.startsWith("/brand"), title: "Brand Dashboard" },

  // influencer
  { match: (p) => p.startsWith("/influencer/profile"), title: "Edit Profile" },
  { match: (p) => p.startsWith("/influencer/onboard"), title: "Onboarding" },
  { match: (p) => p.startsWith("/influencer/pricing"), title: "My Pricing" },
  { match: (p) => p.startsWith("/influencer/discounts"), title: "Discounts" },
  { match: (p) => p.startsWith("/influencer/bids"), title: "My Bids" },
  { match: (p) => p.startsWith("/influencer/deals"), title: "Deals" },
  { match: (p) => p.startsWith("/influencer/chat"), title: "Chat" },
  { match: (p) => p.startsWith("/influencer/campaigns"), title: "Campaigns" },
  { match: (p) => p.startsWith("/influencer"), title: "Creator Dashboard" },

  // admin
  { match: (p) => p.startsWith("/admin/bloggers"), title: "Bloggers · Admin" },
  { match: (p) => p.startsWith("/admin/campaigns"), title: "Campaigns · Admin" },
  { match: (p) => p.startsWith("/admin/deals"), title: "Deals · Admin" },
  { match: (p) => p.startsWith("/admin/users"), title: "Users · Admin" },
  { match: (p) => p.startsWith("/admin/subscriptions"), title: "Subscriptions · Admin" },
  { match: (p) => p.startsWith("/admin/payments"), title: "Payments · Admin" },
  { match: (p) => p.startsWith("/admin/audit-log"), title: "Audit Log · Admin" },
  { match: (p) => p.startsWith("/admin/scraping-queue"), title: "Scraping Queue · Admin" },
  { match: (p) => p.startsWith("/admin/god-mode"), title: "God Mode · Admin" },
  { match: (p) => p.startsWith("/admin"), title: "Admin Dashboard" },
];

export function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const entry = TITLES.find((tt) => tt.match(pathname));
    document.title = entry ? `${entry.title} · ${BASE}` : `${BASE} — Page not found`;
  }, [pathname]);
  return null;
}
