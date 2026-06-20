import { PublicLayout } from "@/components/layout/PublicLayout";
import { LeagueView } from "@/components/league/LeagueView";
import { PageHeader, PageLoader, ErrorState } from "@/components/common";
import { useInfluencers } from "@/hooks/useInfluencers";
import { useLanguage } from "@/hooks/useLanguage";

export default function League() {
  const { t } = useLanguage();
  const { data, loading, error } = useInfluencers();

  return (
    <PublicLayout>
      <div className="container py-10 dark:bg-background">
        <PageHeader title={t("league.title")} subtitle={t("league.subtitle")} />
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorState onRetry={() => window.location.reload()} />
        ) : (
          <LeagueView influencers={data} profileLinkBase="/blogger" />
        )}
      </div>
    </PublicLayout>
  );
}
