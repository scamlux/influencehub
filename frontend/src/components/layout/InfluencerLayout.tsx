import { LayoutDashboard, User, DollarSign, Tag, Megaphone, Send, Handshake } from "lucide-react";
import { DashboardLayout, type NavItem } from "./DashboardLayout";

const items: NavItem[] = [
  { to: "/influencer/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/influencer/profile", labelKey: "nav.profile", icon: User },
  { to: "/influencer/pricing", labelKey: "nav.myPricing", icon: DollarSign },
  { to: "/influencer/discounts", labelKey: "nav.discounts", icon: Tag },
  { to: "/influencer/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
  { to: "/influencer/bids", labelKey: "nav.bids", icon: Send },
  { to: "/influencer/deals", labelKey: "nav.deals", icon: Handshake },
];

export function InfluencerLayout() {
  return <DashboardLayout items={items} title="Creator" />;
}
