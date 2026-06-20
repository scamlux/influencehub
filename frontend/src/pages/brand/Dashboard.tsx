import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Heart,
  Handshake,
  CreditCard,
  Trophy,
  Megaphone,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard, PageHeader } from "@/components/common";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useSubscription } from "@/hooks/useSubscription";
import { brands, deals, favorites } from "@/lib/api";

export default function BrandDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isBrandPro } = useSubscription();
  const [favCount, setFavCount] = useState(0);
  const [dealCount, setDealCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    favorites.forUser(user.id).then((ids) => setFavCount(ids.length));
    brands.profileForUser(user.id).then((bp) => {
      if (bp) deals.forBrand(bp.id).then((d) => setDealCount(d.length));
    });
  }, [user]);

  const quickActions = [
    {
      to: "/brand/league",
      icon: Trophy,
      title: t("dashboard.bloggerLeague"),
      sub: t("dashboard.browseTopBloggers"),
    },
    {
      to: "/brand/campaigns",
      icon: Megaphone,
      title: t("dashboard.campaigns"),
      sub: t("dashboard.managesCampaigns"),
    },
    {
      to: "/brand/deals",
      icon: Handshake,
      title: t("dashboard.deals"),
      sub: t("dashboard.activeDealsTile"),
    },
    {
      to: "/brand/favorites",
      icon: Heart,
      title: t("dashboard.favorites"),
      sub: t("dashboard.savedBloggers"),
    },
  ];

  return (
    <div>
      <PageHeader
        title={`${t("dashboard.welcome")}, ${user?.full_name?.split(" ")[0]}`}
        subtitle={t("dashboard.overview")}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Heart}
          label={t("dashboard.totalFavorites")}
          value={favCount}
          hint={t("dashboard.savedBloggers")}
          delay={0}
        />
        <StatCard
          icon={Handshake}
          label={t("dashboard.activeDeals")}
          value={dealCount}
          hint={t("dashboard.allTimeDeals")}
          delay={0.1}
        />
        <StatCard
          icon={CreditCard}
          label={t("dashboard.subscriptionStatus")}
          value={isBrandPro ? t("common.pro") : t("common.free")}
          accent={isBrandPro}
          delay={0.2}
        />
      </div>

      {!isBrandPro && (
        <Card className="mt-6 overflow-hidden border-0">
          <div className="gradient-primary p-6 text-white">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  <h2 className="text-xl font-bold">{t("dashboard.unlockTitle")}</h2>
                </div>
                <p className="mt-1 text-white/90">{t("dashboard.unlockDesc")}</p>
              </div>
              <Button asChild variant="secondary">
                <Link to="/brand/subscription">
                  {t("dashboard.subscribeNow")} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      )}

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("dashboard.quickActions")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to}>
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-card dark:border dark:border-border dark:hover:bg-secondary">
              <CardContent className="p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <a.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("dashboard.recentActivity")}</h2>
      <Card className="dark:bg-card dark:border dark:border-border">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {t("dashboard.emptyActivity")}
        </CardContent>
      </Card>
    </div>
  );
}
