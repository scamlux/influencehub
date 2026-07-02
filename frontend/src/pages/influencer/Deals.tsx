import { useEffect, useState, useCallback } from "react";
import { Handshake } from "lucide-react";
import { DealRow } from "@/components/campaign/DealRow";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { deals as dealApi, influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
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
    setNames(await dealApi.brandNames(list.map((d) => d.brand_id)));
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
