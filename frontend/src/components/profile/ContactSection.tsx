import { Mail, Phone, Send, Instagram } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LockOverlay } from "./LockOverlay";
import { useLanguage } from "@/hooks/useLanguage";
import type { InfluencerContact } from "@/types";

export function ContactSection({
  contact,
  locked,
  subscribeTo,
}: {
  contact: InfluencerContact | null;
  locked: boolean;
  subscribeTo?: string;
}) {
  const { t } = useLanguage();
  const rows = [
    { icon: Mail, value: contact?.email },
    { icon: Phone, value: contact?.phone },
    { icon: Send, value: contact?.telegram_username },
    { icon: Instagram, value: contact?.instagram_dm },
  ].filter((r) => r.value);

  return (
    <Card className="dark:bg-card dark:border-border">
      <CardHeader>
        <CardTitle>{t("profile.contacts")}</CardTitle>
      </CardHeader>
      <CardContent>
        <LockOverlay locked={locked} subscribeTo={subscribeTo}>
          <div className="space-y-3">
            {rows.length === 0 && (
              <p className="text-sm text-muted-foreground">{t("common.none")}</p>
            )}
            {rows.map((r, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <r.icon className="h-4 w-4 text-muted-foreground" />
                <span>{r.value}</span>
              </div>
            ))}
          </div>
        </LockOverlay>
      </CardContent>
    </Card>
  );
}
