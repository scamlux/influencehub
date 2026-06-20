import { useEffect, useMemo, useState } from "react";
import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check } from "lucide-react";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { BidForm } from "@/components/campaign/BidForm";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { campaigns as campaignApi, influencers, bids as bidApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import type { Campaign, Category, InfluencerFull, Platform } from "@/types";

const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "telegram"];
const CATEGORIES: Category[] = [
  "food",
  "tech",
  "fashion",
  "lifestyle",
  "education",
  "travel",
  "beauty",
  "sports",
  "entertainment",
  "business",
  "auto",
];

export default function InfluencerCampaigns() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<Campaign[]>([]);
  const [inf, setInf] = useState<InfluencerFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [platform, setPlatform] = useState("all");
  const [category, setCategory] = useState("all");
  const [bidFor, setBidFor] = useState<Campaign | null>(null);
  const [bidCampaignIds, setBidCampaignIds] = useState<Set<string>>(new Set());

  const loadBids = (influencerId: string) =>
    bidApi
      .forInfluencer(influencerId)
      .then((bs) => setBidCampaignIds(new Set(bs.map((b) => b.campaign_id))));

  useEffect(() => {
    campaignApi.open().then((d) => {
      setData(d);
      setLoading(false);
    });
    if (user)
      influencers.getByUser(user.id).then((d) => {
        setInf(d);
        if (d) loadBids(d.id);
      });
  }, [user]);

  const filtered = useMemo(
    () =>
      data.filter(
        (c) =>
          (platform === "all" || c.platform === platform) &&
          (category === "all" || c.category === category),
      ),
    [data, platform, category],
  );

  return (
    <div>
      <PageHeader title={t("campaigns.available")} subtitle={t("campaigns.browseDesc")} />

      <div className="mb-4 flex gap-2">
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("league.allPlatforms")}</SelectItem>
            {PLATFORMS.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`platform.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("league.allCategories")}</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {t(`category.${c}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <PageLoader />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("campaigns.noCampaigns")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const alreadyBid = bidCampaignIds.has(c.id);
            return (
              <CampaignCard
                key={c.id}
                campaign={c}
                footer={
                  alreadyBid ? (
                    <Button className="w-full" variant="outline" disabled>
                      <Check className="h-4 w-4" /> {t("campaigns.bidSubmitted")}
                    </Button>
                  ) : (
                    <Button className="w-full" onClick={() => setBidFor(c)} disabled={!inf}>
                      {t("campaigns.submitBid")}
                    </Button>
                  )
                }
              />
            );
          })}
        </div>
      )}

      {bidFor && inf && (
        <BidForm
          campaign={bidFor}
          influencerId={inf.id}
          open={!!bidFor}
          onOpenChange={(o) => !o && setBidFor(null)}
          onSubmitted={() => loadBids(inf.id)}
        />
      )}
    </div>
  );
}
