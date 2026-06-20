import {
  LayoutDashboard,
  Users,
  Trophy,
  Megaphone,
  Handshake,
  CreditCard,
  ScrollText,
  ListChecks,
  Zap,
  BadgeDollarSign,
} from "lucide-react";
import { DashboardLayout, type NavItem } from "./DashboardLayout";

const items: NavItem[] = [
  { to: "/admin/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { to: "/admin/bloggers", labelKey: "nav.bloggers", icon: Trophy },
  { to: "/admin/campaigns", labelKey: "nav.campaigns", icon: Megaphone },
  { to: "/admin/deals", labelKey: "nav.deals", icon: Handshake },
  { to: "/admin/users", labelKey: "nav.users", icon: Users },
  { to: "/admin/subscriptions", labelKey: "subscriptions.title", icon: BadgeDollarSign },
  { to: "/admin/payments", labelKey: "nav.payments", icon: CreditCard },
  { to: "/admin/audit-log", labelKey: "nav.auditLog", icon: ScrollText },
  { to: "/admin/scraping-queue", labelKey: "nav.scrapingQueue", icon: ListChecks },
  { to: "/admin/god-mode", labelKey: "nav.godMode", icon: Zap },
];

export function AdminLayout() {
  return (
    <DashboardLayout
      items={items}
      title="Admin"
      sidebarClassName="dark:bg-[#0c0c18] dark:border-r dark:border-border"
      navActiveClassName="dark:bg-white/10 dark:text-white"
      navInactiveClassName="dark:text-muted-foreground dark:hover:bg-white/5 dark:hover:text-white"
    />
  );
}
