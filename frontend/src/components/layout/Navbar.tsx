import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Sparkles, Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { LanguageToggle } from "./LanguageToggle";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { dashboardPath } from "@/components/RoleGuard";

export function Navbar() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { to: "/", label: t("nav.home") },
    { to: "/league", label: t("nav.league") },
    { to: "/pricing", label: t("nav.pricing") },
  ];

  return (
    <header className="sticky top-0 z-sticky w-full border-b bg-background/75 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="group flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary shadow-glow transition-transform duration-200 group-hover:scale-105">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Influence<span className="text-gradient">Hub</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === "/"}
              className={({ isActive }) =>
                cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 -z-10 rounded-lg bg-secondary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {l.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <LanguageToggle />
          {user ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate(dashboardPath(user.role))}>
                {t("nav.dashboard")}
              </Button>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
                {t("nav.login")}
              </Button>
              <Button variant="gradient" size="sm" onClick={() => navigate("/register")}>
                {t("nav.register")}
              </Button>
            </>
          )}
        </div>

        {/* Mobile actions: keep only the essentials inline, rest in the menu */}
        <div className="flex items-center gap-1 md:hidden">
          {/* On phones the theme toggle lives inside the menu to avoid crowding;
              shown inline from sm (tablet) up. */}
          <span className="hidden sm:flex">
            <ThemeToggle />
          </span>
          {user && <NotificationBell />}
          {user && <UserMenu />}
          <Button variant="ghost" size="icon" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile dropdown panel */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="border-t bg-background md:hidden"
        >
          <nav className="container flex flex-col gap-1 py-3">
            {navLinks.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
            <div className="my-2 h-px bg-border" />
            {user ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate(dashboardPath(user.role));
                }}
              >
                {t("nav.dashboard")}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    navigate("/login");
                  }}
                >
                  {t("nav.login")}
                </Button>
                <Button
                  variant="gradient"
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    navigate("/register");
                  }}
                >
                  {t("nav.register")}
                </Button>
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 px-1">
              {/* phone-only: the toggle that was removed from the top bar */}
              <span className="sm:hidden">
                <ThemeToggle />
              </span>
              <LanguageToggle />
            </div>
          </nav>
        </motion.div>
      )}
    </header>
  );
}
