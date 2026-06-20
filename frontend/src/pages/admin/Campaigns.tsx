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
import { PageHeader, PageLoader } from "@/components/common";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { campaigns as campaignApi } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD, formatDate } from "@/lib/utils";
import type { Campaign } from "@/types";

export default function AdminCampaigns() {
  const { t } = useLanguage();
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    campaignApi.list().then((d) => {
      setData(d);
      setLoading(false);
    });
  }, []);

  const { current, page, pageCount, next, prev } = usePagination(data, 10);

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title={t("nav.campaigns")} subtitle={`${data.length} total`} />
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("campaigns.title")}</TableHead>
              <TableHead>{t("league.platform")}</TableHead>
              <TableHead>{t("campaigns.budget")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("campaigns.deadline")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.title}</TableCell>
                <TableCell>{t(`platform.${c.platform}`)}</TableCell>
                <TableCell>{formatUSD(c.budget_usd)}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.deadline)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPrev={prev} onNext={next} />
    </div>
  );
}
