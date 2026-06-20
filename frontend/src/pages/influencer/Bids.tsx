import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/campaign/DealStatusBadge";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { bids as bidApi, campaigns as campaignApi, influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD, timeAgo } from "@/lib/utils";
import type { Bid } from "@/types";

export default function InfluencerBids() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<Bid[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    influencers.getByUser(user.id).then(async (inf) => {
      if (!inf) return setLoading(false);
      const list = await bidApi.forInfluencer(inf.id);
      setData(list);
      const map: Record<string, string> = {};
      for (const b of list) {
        const c = await campaignApi.get(b.campaign_id);
        if (c) map[b.campaign_id] = c.title;
      }
      setTitles(map);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title={t("bids.title")} subtitle={t("bids.subtitle")} />
      {data.length === 0 ? (
        <EmptyState icon={Send} title={t("bids.noBids")} />
      ) : (
        <div className="space-y-3">
          {data.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-semibold">{titles[b.campaign_id] ?? "Campaign"}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatUSD(b.proposed_price)} · {b.delivery_days}d · {timeAgo(b.created_at)}
                  </p>
                </div>
                <StatusBadge status={b.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
