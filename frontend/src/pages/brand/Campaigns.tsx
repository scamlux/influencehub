import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CampaignCard } from "@/components/campaign/CampaignCard";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { brands, campaigns as campaignApi, bids as bidApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import type { Campaign } from "@/types";

export default function BrandCampaigns() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<Campaign[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const bp = await brands.profileForUser(user.id);
      if (!bp) return setLoading(false);
      const list = await campaignApi.forBrand(bp.id);
      setData(list);
      const entries = await Promise.all(
        list.map(async (c) => [c.id, (await bidApi.forCampaign(c.id)).length] as const),
      );
      setCounts(Object.fromEntries(entries));
      setLoading(false);
    })();
  }, [user]);

  return (
    <div>
      <PageHeader
        title={t("campaigns.title")}
        subtitle={t("campaigns.subtitle")}
        action={
          <Button asChild>
            <Link to="/brand/campaigns/new">
              <Plus className="h-4 w-4" /> {t("campaigns.create")}
            </Link>
          </Button>
        }
      />
      {loading ? (
        <PageLoader />
      ) : data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={t("campaigns.noCampaigns")}
          action={
            <Button asChild>
              <Link to="/brand/campaigns/new">
                <Plus className="h-4 w-4" /> {t("campaigns.create")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <CampaignCard
              key={c.id}
              campaign={c}
              footer={
                <Button asChild variant="outline" className="w-full">
                  <Link to={`/brand/campaigns/${c.id}`}>
                    {counts[c.id] ?? 0} {t("campaigns.bids")}
                  </Link>
                </Button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
