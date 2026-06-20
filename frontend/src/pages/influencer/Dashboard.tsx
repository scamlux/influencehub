import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Trophy, Eye, DollarSign, Tag, User, Megaphone, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard, PageHeader, PageLoader } from "@/components/common";
import { influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import type { InfluencerFull } from "@/types";

export default function InfluencerDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [inf, setInf] = useState<InfluencerFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    influencers.getByUser(user.id).then((d) => {
      setInf(d);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <PageLoader />;

  if (inf && inf.onboarding_status === "pending") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <Sparkles className="h-10 w-10 text-primary" />
          <h2 className="text-xl font-bold">{t("onboarding.title")}</h2>
          <p className="max-w-md text-muted-foreground">{t("onboarding.subtitle")}</p>
          <Button onClick={() => navigate("/influencer/onboard")}>
            {t("onboarding.getStarted")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Profile views only exist once a creator has synced platforms with an
  // audience — brand-new accounts start at 0 instead of a fabricated number.
  const hasAudience = !!inf && inf.total_followers > 0;
  const profileViews = hasAudience ? (inf!.total_followers % 5000) + 320 : 0;

  const quickActions = [
    { to: "/influencer/profile", icon: User, title: t("influencer.editProfile") },
    { to: "/influencer/pricing", icon: DollarSign, title: t("influencer.managePricing") },
    { to: "/influencer/discounts", icon: Tag, title: t("influencer.manageDiscounts") },
    { to: "/influencer/campaigns", icon: Megaphone, title: t("campaigns.available") },
  ];

  return (
    <div>
      <PageHeader
        title={`${t("dashboard.welcome")}, ${user?.full_name?.split(" ")[0]}`}
        subtitle={t("dashboard.overview")}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Trophy}
          label={t("influencer.rank")}
          value={inf?.league_rank ? `#${inf.league_rank}` : "—"}
          accent
          delay={0}
        />
        <StatCard
          icon={Eye}
          label={t("influencer.profileViews")}
          value={profileViews.toLocaleString()}
          hint={hasAudience ? t("influencer.profileViewsDemo") : undefined}
          delay={0.1}
        />
        <StatCard
          icon={DollarSign}
          label={t("influencer.pricingItems")}
          value={inf?.prices.length ?? 0}
          delay={0.2}
        />
        <StatCard
          icon={Tag}
          label={t("influencer.activeDiscounts")}
          value={inf?.discounts.length ?? 0}
          delay={0.3}
        />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">{t("influencer.quickActions")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to}>
            <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-card dark:border dark:border-border dark:hover:bg-secondary">
              <CardContent className="flex items-center gap-3 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20">
                  <a.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-medium">{a.title}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
