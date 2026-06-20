import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";

export function LockOverlay({
  locked,
  children,
  subscribeTo = "/brand/subscription",
}: {
  locked: boolean;
  children: ReactNode;
  subscribeTo?: string;
}) {
  const { t } = useLanguage();
  if (!locked) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-sm" aria-hidden>
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-background/60 backdrop-blur-[2px]">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-6 w-6 text-primary" />
        </div>
        <Button asChild>
          <Link to={subscribeTo}>{t("profile.locked")}</Link>
        </Button>
      </div>
    </div>
  );
}
