import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { dashboardPath } from "@/components/RoleGuard";

export default function Forbidden() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-3xl font-bold">403 — {t("forbidden.title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("forbidden.subtitle")}</p>
      <div className="flex gap-3">
        <Button onClick={() => navigate(dashboardPath(user?.role ?? null))}>
          {t("forbidden.dashboard")}
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/")}
          className="dark:border-white/20 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
        >
          {t("forbidden.home")}
        </Button>
      </div>
    </div>
  );
}
