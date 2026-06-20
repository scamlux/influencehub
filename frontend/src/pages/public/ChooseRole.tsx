import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Star } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { dashboardPath } from "@/components/RoleGuard";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

export default function ChooseRole() {
  const { t } = useLanguage();
  const { user, loading, setRole } = useAuth();
  const navigate = useNavigate();
  const [role, setSelected] = useState<UserRole>("brand");
  const [saving, setSaving] = useState(false);

  // Choose-role is only for an authenticated user who has no role yet.
  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
    else if (user.role) navigate(dashboardPath(user.role), { replace: true });
  }, [loading, user, navigate]);

  const submit = async () => {
    setSaving(true);
    await setRole(role);
    navigate(role === "influencer" ? "/influencer/onboard" : dashboardPath(role));
  };

  return (
    <AuthShell
      title={t("auth.selectRole")}
      subtitle={user ? `Signed in as ${user.email}` : undefined}
    >
      <div className="grid grid-cols-2 gap-3">
        {[
          {
            value: "brand" as const,
            icon: Briefcase,
            label: t("auth.brand"),
            desc: t("auth.brandDesc"),
          },
          {
            value: "influencer" as const,
            icon: Star,
            label: t("auth.influencer"),
            desc: t("auth.influencerDesc"),
          },
        ].map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setSelected(r.value)}
            className={cn(
              "rounded-xl border p-4 text-left transition-colors",
              role === r.value ? "border-primary bg-primary/5" : "hover:bg-secondary",
            )}
          >
            <r.icon
              className={cn("h-5 w-5", role === r.value ? "text-primary" : "text-muted-foreground")}
            />
            <p className="mt-2 font-medium">{r.label}</p>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </button>
        ))}
      </div>
      <Button className="mt-6 w-full" onClick={submit} disabled={saving}>
        {t("common.next")}
      </Button>
    </AuthShell>
  );
}
