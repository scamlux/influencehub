import {
  LayoutDashboard,
  Trophy,
  Megaphone,
  Handshake,
  Heart,
  Settings,
  CreditCard,
  GitCompare,
} from "lucide-react";
import { DashboardLayout, type NavItem } from "./DashboardLayout";

const items: NavItem[] = [
  { to: "/brand/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/brand/league", labelKey: "nav.league", icon: Trophy },
  { to: "/brand/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
  { to: "/brand/deals", labelKey: "nav.deals", icon: Handshake },
  { to: "/brand/compare", labelKey: "nav.compare", icon: GitCompare },
  { to: "/brand/favorites", labelKey: "nav.favorites", icon: Heart },
  { to: "/brand/subscription", labelKey: "nav.subscription", icon: CreditCard },
  { to: "/brand/settings", labelKey: "nav.settings", icon: Settings },
];

export function BrandLayout() {
  return <DashboardLayout items={items} title="Brand" />;
}
