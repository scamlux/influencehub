import { useEffect, useState, useCallback } from "react";
import { Handshake } from "lucide-react";
import { DealRow } from "@/components/campaign/DealRow";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { brands, deals as dealApi, influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import type { Deal } from "@/types";

export default function BrandDeals() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [data, setData] = useState<Deal[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return setLoading(false);
    const bp = await brands.profileForUser(user.id);
    if (!bp) return setLoading(false);
    const list = await dealApi.forBrand(bp.id);
    setData(list);
    const map: Record<string, string> = {};
    for (const d of list) {
      const inf = await influencers.get(d.influencer_id);
      if (inf) map[d.influencer_id] = inf.display_name;
    }
    setNames(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (dealId: string, status: Deal["status"]) => {
    await dealApi.setStatus(dealId, status);
    toast({ title: t("common.success"), variant: "success" });
    load();
  };

  return (
    <div>
      <PageHeader title={t("deals.title")} subtitle={t("deals.subtitle")} />
      {loading ? (
        <PageLoader />
      ) : data.length === 0 ? (
        <EmptyState icon={Handshake} title={t("deals.noDeals")} />
      ) : (
        <div className="space-y-4">
          {data.map((d) => (
            <DealRow
              key={d.id}
              deal={d}
              counterpartyName={names[d.influencer_id] ?? "Influencer"}
              role="brand"
              chatBase="/brand/chat"
              onSetStatus={(s) => setStatus(d.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
