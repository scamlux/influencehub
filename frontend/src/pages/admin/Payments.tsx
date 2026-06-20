import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { PageHeader } from "@/components/common";
import { admin } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD, formatDate } from "@/lib/utils";

const paymentVariant = (status: string): BadgeProps["variant"] => {
  if (status === "succeeded" || status === "paid") return "success";
  if (status === "failed") return "destructive";
  if (status === "pending") return "warning";
  return "secondary";
};

type Payment = Awaited<ReturnType<typeof admin.payments>>[number];

export default function AdminPayments() {
  const { t } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    admin.payments().then(setPayments);
    admin
      .allUsers()
      .then((users) => setEmails(Object.fromEntries(users.map((u) => [u.id, u.email]))));
  }, []);

  const email = (uid: string) => emails[uid] ?? "—";

  return (
    <div>
      <PageHeader title={t("nav.payments")} subtitle={`${payments.length} records`} />
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>Session</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{email(p.user_id)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{p.plan_type}</Badge>
                </TableCell>
                <TableCell className="font-medium">{formatUSD(p.amount)}</TableCell>
                <TableCell>
                  <Badge variant={paymentVariant(p.status)}>{p.status}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {p.stripe_session_id}
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
