import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/common";
import { admin } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { Subscription } from "@/types";

const PLAN_LABEL: Record<string, string> = {
  brand_pro: "Brand Pro",
  influencer_feature: "Influencer Feature",
  influencer_sync: "Influencer Sync",
};

export default function AdminSubscriptions() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [rows, setRows] = useState<Subscription[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    admin.allSubscriptions().then(setRows);
    admin
      .allUsers()
      .then((users) => setNames(Object.fromEntries(users.map((u) => [u.id, u.full_name]))));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const userName = (userId: string) => names[userId] ?? "—";
  const isExpired = (expires: string | null) => !!expires && new Date(expires) < new Date();

  const cancel = async (id: string) => {
    await admin.cancelSubscription(id);
    toast({ title: t("common.success"), variant: "success" });
    load();
  };

  return (
    <div>
      <PageHeader title={t("subscriptions.title")} subtitle={t("subscriptions.subtitle")} />
      {rows.length === 0 ? (
        <EmptyState icon={CreditCard} title={t("subscriptions.none")} />
      ) : (
        <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("subscriptions.user")}</TableHead>
                <TableHead>{t("subscriptions.plan")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("subscriptions.expires")}</TableHead>
                <TableHead className="text-right">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => {
                const expired = isExpired(s.expires_at);
                const active = s.status === "active" && !expired;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{userName(s.user_id)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{PLAN_LABEL[s.plan_type] ?? s.plan_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={active ? "success" : "muted"}>
                        {s.status === "cancelled"
                          ? "Cancelled"
                          : expired
                            ? "Expired"
                            : t("common.active")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {s.expires_at ? formatDate(s.expires_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!active}
                        onClick={() => cancel(s.id)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
