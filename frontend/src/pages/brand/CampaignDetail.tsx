import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { BidCard } from "@/components/campaign/BidCard";
import { PageLoader, EmptyState } from "@/components/common";
import { bids as bidApi, campaigns as campaignApi, influencers } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import type { Bid, Campaign, InfluencerFull } from "@/types";

export default function CampaignDetail() {
  const { id } = useParams();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [bidList, setBidList] = useState<Bid[]>([]);
  const [infMap, setInfMap] = useState<Record<string, InfluencerFull>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const c = await campaignApi.get(id);
    setCampaign(c);
    const bs = await bidApi.forCampaign(id);
    setBidList(bs);
    const infs = await Promise.all(bs.map((b) => influencers.get(b.influencer_id)));
    const map: Record<string, InfluencerFull> = {};
    infs.forEach((i) => i && (map[i.id] = i));
    setInfMap(map);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const accept = async (bidId: string) => {
    await bidApi.accept(bidId);
    toast({ title: "Bid accepted — deal created", variant: "success" });
    load();
  };
  const reject = async (bidId: string) => {
    await bidApi.reject(bidId);
    toast({ title: "Bid rejected" });
    load();
  };

  if (loading) return <PageLoader />;
  if (!campaign) return <EmptyState icon={Inbox} title={t("campaigns.noCampaigns")} />;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/brand/campaigns">
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
      </Button>

      <CampaignCard campaign={campaign} />

      {campaign.requirements && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-1 font-semibold">{t("campaigns.requirements")}</h3>
            <p className="text-sm text-muted-foreground">{campaign.requirements}</p>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold">{t("campaigns.bids")}</h2>
          <Badge variant="secondary">{bidList.length}</Badge>
        </div>
        {bidList.length === 0 ? (
          <EmptyState icon={Inbox} title={t("campaigns.noBids")} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {bidList.map((b) => (
              <BidCard
                key={b.id}
                bid={b}
                influencer={infMap[b.influencer_id]}
                onAccept={() => accept(b.id)}
                onReject={() => reject(b.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
