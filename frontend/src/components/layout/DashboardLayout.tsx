import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { Sparkles, Menu, X, LogOut } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageToggle } from "./LanguageToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserMenu } from "./UserMenu";

export interface NavItem {
  to: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function DashboardLayout({
  items,
  title,
  sidebarClassName,
  navActiveClassName,
  navInactiveClassName,
}: {
  items: NavItem[];
  title: string;
  /** Extra classes for the sidebar surface (lets Admin use a darker shell). */
  sidebarClassName?: string;
  navActiveClassName?: string;
  navInactiveClassName?: string;
}) {
  const { t } = useLanguage();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const SidebarInner = (
    <div className="flex h-full flex-col">
      <Link to="/" className="group flex items-center gap-2.5 px-6 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-glow transition-transform duration-200 group-hover:scale-105">
          <Sparkles className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-bold tracking-tight">
          Influence<span className="text-gradient">Hub</span>
        </span>
      </Link>
      <div className="px-6 pb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            end={item.to.endsWith("dashboard")}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? cn("text-primary", navActiveClassName)
                  : cn(
                      "text-muted-foreground hover:bg-secondary hover:text-foreground",
                      navInactiveClassName,
                    ),
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-active"
                    className="absolute inset-0 -z-10 rounded-lg bg-primary/10"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <item.icon className="h-4 w-4 shrink-0" />
                {t(item.labelKey)}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          <LogOut className="h-4 w-4" />
          {t("nav.logout")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="relative z-raised flex min-h-screen bg-secondary/30 dark:bg-transparent">
      {/* Backdrop — mobile/tablet only, while the drawer is open */}
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-overlay bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/*
        Sidebar — fixed at all breakpoints:
        - mobile/tablet (< lg): off-screen overlay that slides in via translate-x
        - desktop (>= lg): always visible (lg:translate-x-0). Since it stays
          `fixed` (out of flow), the main column gets `lg:ml-64` to clear it.
      */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-overlay flex w-64 flex-col overflow-y-auto border-r bg-background/95 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:translate-x-0 dark:bg-card/80 dark:border-border",
          open ? "translate-x-0" : "-translate-x-full",
          sidebarClassName,
        )}
      >
        <button
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
        {SidebarInner}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header className="sticky top-0 z-sticky flex h-16 items-center justify-between border-b bg-background/75 px-4 backdrop-blur-xl lg:px-8 dark:bg-card/70 dark:border-border">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <NotificationBell />
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-6xl"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
