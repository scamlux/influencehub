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

  // When locked we don't reveal the real (often empty) content — we show a
  // consistent blurred placeholder so every locked card has the same height and
  // clearly reads as "there's something premium to unlock here".
  return (
    <div className="relative min-h-[132px] overflow-hidden rounded-lg">
      <div aria-hidden className="select-none space-y-3 opacity-60 blur-[7px]">
        <div className="h-4 w-3/5 rounded-full bg-muted-foreground/25" />
        <div className="h-4 w-2/5 rounded-full bg-muted-foreground/25" />
        <div className="h-4 w-1/2 rounded-full bg-muted-foreground/25" />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-gradient-to-b from-background/30 via-background/60 to-background/85 px-4 text-center backdrop-blur-[2px]">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 ring-1 ring-primary/20">
          <Lock className="h-5 w-5 text-primary" aria-hidden="true" focusable="false" />
        </div>
        <Button asChild size="sm" variant="gradient">
          <Link to={subscribeTo}>{t("profile.locked")}</Link>
        </Button>
      </div>
    </div>
  );
}
