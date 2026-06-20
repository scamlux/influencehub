import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { GitCompare, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/icons";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { LockOverlay } from "@/components/profile/LockOverlay";
import { influencers } from "@/lib/api";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/hooks/useLanguage";
import { useCompare, MAX_COMPARE } from "@/hooks/useCompare";
import { formatNumber, formatUSD, initials } from "@/lib/utils";
import type { AdType, InfluencerFull } from "@/types";

const AD_TYPES: AdType[] = ["post", "story", "video", "reel", "package", "native"];

export default function Compare() {
  const [params, setParams] = useSearchParams();
  const { t } = useLanguage();
  const { isBrandPro } = useSubscription();
  const { selected, set, remove } = useCompare();
  const [list, setList] = useState<InfluencerFull[]>([]);
  const [loading, setLoading] = useState(true);

  // Seed the shared store from the URL on first load (e.g. shared link),
  // otherwise fall back to whatever the brand selected in the league.
  useEffect(() => {
    const urlIds = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, MAX_COMPARE);
    if (urlIds.length) {
      set(urlIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the URL in sync with the shared selection so the view is shareable.
  useEffect(() => {
    const current = params.get("ids") ?? "";
    const next = selected.join(",");
    if (current !== next) {
      setParams(next ? { ids: next } : {}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    setLoading(true);
    Promise.all(selected.map((id) => influencers.get(id))).then((res) => {
      setList(res.filter(Boolean) as InfluencerFull[]);
      setLoading(false);
    });
  }, [selected]);

  if (loading) return <PageLoader />;
  if (list.length === 0)
    return (
      <div>
        <PageHeader title={t("nav.compare")} />
        <EmptyState
          icon={GitCompare}
          title="Nothing to compare"
          description="Select up to 3 bloggers from the league using the checkboxes."
          action={
            <Button asChild>
              <Link to="/brand/league">{t("league.title")}</Link>
            </Button>
          }
        />
      </div>
    );

  const priceFor = (inf: InfluencerFull, type: AdType) =>
    inf.prices.find((p) => p.ad_type === type)?.price_usd;

  return (
    <div>
      <PageHeader title={t("nav.compare")} subtitle={`${list.length} bloggers`} />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-4 text-left font-medium text-muted-foreground">
                {t("home.compare.feature")}
              </th>
              {list.map((inf) => (
                <th key={inf.id} className="p-4 text-center">
                  <div className="relative flex flex-col items-center gap-2">
                    <button
                      onClick={() => remove(inf.id)}
                      className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
                      aria-label="Remove from comparison"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={inf.avatar_url ?? undefined} />
                      <AvatarFallback>{initials(inf.display_name)}</AvatarFallback>
                    </Avatar>
                    <Link
                      to={`/brand/bloggers/${inf.id}`}
                      className="font-semibold hover:text-primary"
                    >
                      {inf.display_name}
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label={t("league.followers")}>
              {list.map((i) => (
                <Cell key={i.id}>{formatNumber(i.total_followers)}</Cell>
              ))}
            </Row>
            <Row label={t("league.engagement")}>
              {list.map((i) => (
                <Cell key={i.id}>{i.engagement_rate?.toFixed(1)}%</Cell>
              ))}
            </Row>
            <Row label={t("league.category")}>
              {list.map((i) => (
                <Cell key={i.id}>
                  <Badge variant="secondary">{t(`category.${i.category}`)}</Badge>
                </Cell>
              ))}
            </Row>
            <Row label={t("influencer.city")}>
              {list.map((i) => (
                <Cell key={i.id}>{i.city}</Cell>
              ))}
            </Row>
            <Row label={t("league.platform")}>
              {list.map((i) => (
                <Cell key={i.id}>
                  <div className="flex justify-center gap-1.5">
                    {i.platforms.map((p) => (
                      <PlatformIcon key={p.id} platform={p.platform} />
                    ))}
                  </div>
                </Cell>
              ))}
            </Row>
            {AD_TYPES.map((type) => (
              <Row key={type} label={t(`adType.${type}`)}>
                {list.map((i) => (
                  <Cell key={i.id}>
                    <LockOverlay locked={!isBrandPro} subscribeTo="/brand/subscription">
                      {priceFor(i, type) ? formatUSD(priceFor(i, type)!) : "—"}
                    </LockOverlay>
                  </Cell>
                ))}
              </Row>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b last:border-0">
      <td className="p-4 font-medium text-muted-foreground">{label}</td>
      {children}
    </tr>
  );
}
function Cell({ children }: { children: React.ReactNode }) {
  return <td className="p-4 text-center font-medium">{children}</td>;
}
