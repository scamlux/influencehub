import { Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LockOverlay } from "./LockOverlay";
import { useLanguage } from "@/hooks/useLanguage";
import { formatDate } from "@/lib/utils";
import type { Discount } from "@/types";

export function DiscountsSection({
  discounts,
  locked,
  subscribeTo,
}: {
  discounts: Discount[];
  locked: boolean;
  subscribeTo?: string;
}) {
  const { t } = useLanguage();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("profile.discounts")}</CardTitle>
      </CardHeader>
      <CardContent>
        <LockOverlay locked={locked} subscribeTo={subscribeTo}>
          {discounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("common.none")}</p>
          ) : (
            <div className="space-y-3">
              {discounts.map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Tag className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.title}</span>
                      <Badge>{d.discount_percent}% off</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("influencer.validUntil")}: {formatDate(d.valid_until)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LockOverlay>
      </CardContent>
    </Card>
  );
}
