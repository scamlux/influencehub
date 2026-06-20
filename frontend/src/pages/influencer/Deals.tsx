import { useEffect, useState, useCallback } from "react";
import { Handshake } from "lucide-react";
import { DealRow } from "@/components/campaign/DealRow";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { deals as dealApi, influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { mockDB } from "@/lib/mock-data";
import type { Deal } from "@/types";

export default function InfluencerDeals() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [data, setData] = useState<Deal[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const inf = await influencers.getByUser(user.id);
    if (!inf) return setLoading(false);
    const list = await dealApi.forInfluencer(inf.id);
    setData(list);
    const map: Record<string, string> = {};
    list.forEach((d) => {
      const bp = mockDB.brand_profiles.find((b) => b.id === d.brand_id);
      const profile = bp ? mockDB.profiles.find((p) => p.id === bp.user_id) : null;
      map[d.brand_id] = profile?.full_name ?? "Brand";
    });
    setNames(map);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const submitContent = async (dealId: string, url: string) => {
    await dealApi.submitContent(dealId, url);
    toast({ title: t("common.success"), variant: "success" });
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title={t("deals.title")} subtitle={t("deals.subtitle")} />
      {data.length === 0 ? (
        <EmptyState icon={Handshake} title={t("deals.noDeals")} />
      ) : (
        <div className="space-y-4">
          {data.map((d) => (
            <DealRow
              key={d.id}
              deal={d}
              counterpartyName={names[d.brand_id] ?? "Brand"}
              role="influencer"
              chatBase="/influencer/chat"
              onSubmitContent={(url) => submitContent(d.id, url)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
