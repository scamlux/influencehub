import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { LeagueView } from "@/components/league/LeagueView";
import { PageHeader, PageLoader, ErrorState } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useInfluencers } from "@/hooks/useInfluencers";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/hooks/useLanguage";

export default function BrandLeague() {
  const { t } = useLanguage();
  const { data, loading, error } = useInfluencers();
  const { isBrandPro } = useSubscription();

  return (
    <div className="dark:bg-background">
      <PageHeader title={t("league.title")} subtitle={t("league.subtitle")} />
      {!isBrandPro && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <p className="text-sm">
                Contacts, prices & discounts are locked. Upgrade to <strong>Brand Pro</strong> to
                unlock.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/brand/subscription">{t("dashboard.subscribeNow")}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {loading ? (
        <PageLoader />
      ) : error ? (
        <ErrorState onRetry={() => window.location.reload()} />
      ) : (
        <LeagueView influencers={data} profileLinkBase="/brand/bloggers" enableCompare />
      )}
    </div>
  );
}
