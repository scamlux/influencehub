import { useCallback, useEffect, useState } from "react";
import { Banknote } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/common";
import { admin, influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { formatUSD, formatDate } from "@/lib/utils";
import type { Payout } from "@/types";

const paymentVariant = (status: string): BadgeProps["variant"] => {
  if (status === "succeeded" || status === "paid") return "success";
  if (status === "failed") return "destructive";
  if (status === "pending") return "warning";
  return "secondary";
};

type Payment = Awaited<ReturnType<typeof admin.payments>>[number];

export default function AdminPayments() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pays, pouts, users] = await Promise.all([
      admin.payments(),
      admin.payouts(),
      admin.allUsers(),
    ]);
    setPayments(pays);
    setPayouts(pouts);
    setEmails(Object.fromEntries(users.map((u) => [u.id, u.email])));
    const uniqueInf = [...new Set(pouts.map((p) => p.influencer_id))];
    const resolved = await Promise.all(uniqueInf.map((id) => influencers.get(id)));
    setNames(
      Object.fromEntries(uniqueInf.map((id, i) => [id, resolved[i]?.display_name ?? "—"])),
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const email = (uid: string) => emails[uid] ?? "—";

  const markPaid = async (payout: Payout) => {
    if (!user) return;
    setBusy(payout.id);
    try {
      await admin.markPayoutPaid(payout.id, user.id);
      toast({ title: t("payouts.marked"), variant: "success" });
      await load();
    } catch (e) {
      toast({ title: t("common.error"), description: String(e), variant: "error" });
    } finally {
      setBusy(null);
    }
  };

  const pending = payouts.filter((p) => p.status === "pending");

  return (
    <div className="space-y-8">
      <div>
        <PageHeader
          title={t("payouts.title")}
          subtitle={t("payouts.subtitle").replace("{count}", String(pending.length))}
        />
        <div className="rounded-xl border bg-card dark:border-border">
          {payouts.length === 0 ? (
            <EmptyState icon={Banknote} title={t("payouts.empty")} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("payouts.creator")}</TableHead>
                  <TableHead>{t("deal.escrow.payout")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{names[p.influencer_id] ?? "—"}</TableCell>
                    <TableCell className="font-medium">{formatUSD(p.amount_cents / 100)}</TableCell>
                    <TableCell>
                      <Badge variant={paymentVariant(p.status)}>{p.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {p.status === "pending" ? (
                        <Button size="sm" disabled={busy === p.id} onClick={() => markPaid(p)}>
                          {t("payouts.markPaid")}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {p.paid_at ? formatDate(p.paid_at) : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      <div>
        <PageHeader title={t("nav.payments")} subtitle={`${payments.length} records`} />
        <div className="rounded-xl border bg-card dark:border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="text-muted-foreground">{email(p.user_id)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{p.plan_type ?? "deal"}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatUSD(p.amount)}
                    {p.currency && p.currency !== "USD" ? ` ${p.currency}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={paymentVariant(p.status)}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.stripe_session_id ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
