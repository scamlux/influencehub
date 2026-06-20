import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/campaign/DealStatusBadge";
import { PageHeader } from "@/components/common";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { useLanguage } from "@/hooks/useLanguage";
import { admin, influencers } from "@/lib/api";
import { formatUSD, formatDate } from "@/lib/utils";
import type { Deal } from "@/types";

export default function AdminDeals() {
  const { t } = useLanguage();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    admin.allDeals().then(setDeals);
    influencers
      .listAll()
      .then((list) => setNames(Object.fromEntries(list.map((i) => [i.id, i.display_name]))));
  }, []);

  const { current, page, pageCount, next, prev } = usePagination(deals, 10);
  const infName = (id: string) => names[id] ?? "—";

  return (
    <div>
      <PageHeader title={t("nav.deals")} subtitle={`${deals.length} total`} />
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("league.blogger")}</TableHead>
              <TableHead>{t("deals.agreedPrice")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{infName(d.influencer_id)}</TableCell>
                <TableCell>{formatUSD(d.agreed_price)}</TableCell>
                <TableCell>
                  <StatusBadge status={d.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPrev={prev} onNext={next} />
    </div>
  );
}
