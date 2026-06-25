import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Heart, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { InfluencerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon, platformColor } from "@/components/icons";
import { AnalyticsChart } from "./AnalyticsChart";
import { ContactSection } from "./ContactSection";
import { PricingSection } from "./PricingSection";
import { DiscountsSection } from "./DiscountsSection";
import { influencers, favorites } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { formatNumber, formatEr, timeAgo, cn } from "@/lib/utils";
import type { AnalyticsHistory, InfluencerFull } from "@/types";

export function ProfileView({
  influencer,
  locked,
  backTo,
  subscribeTo = "/pricing",
  showVerified = false,
  enableFavorite = false,
}: {
  influencer: InfluencerFull;
  locked: boolean;
  backTo: string;
  subscribeTo?: string;
  showVerified?: boolean;
  enableFavorite?: boolean;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [history, setHistory] = useState<AnalyticsHistory[]>([]);
  const [isFav, setIsFav] = useState(false);

  useEffect(() => {
    influencers.analytics(influencer.id).then(setHistory);
    if (user) favorites.forUser(user.id).then((ids) => setIsFav(ids.includes(influencer.id)));
  }, [influencer.id, user]);

  const toggleFav = async () => {
    if (!user) return;
    setIsFav(await favorites.toggle(user.id, influencer.id));
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={backTo}>
          <ArrowLeft className="h-4 w-4" /> {t("common.back")}
        </Link>
      </Button>

      {/* Header */}
      <Card className="dark:bg-card dark:border-border">
        <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
          <InfluencerAvatar
            name={influencer.display_name}
            avatarUrl={influencer.avatar_url}
            platforms={influencer.platforms}
            className="h-24 w-24 ring-4 ring-primary/10"
            fallbackClassName="text-2xl"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{influencer.display_name}</h1>
              {showVerified && (
                <span title={t("profile.verified")}>
                  <BadgeCheck className="h-6 w-6 text-primary" />
                </span>
              )}
              {influencer.is_featured && (
                <Badge className="gradient-primary border-0">{t("league.featured")}</Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{t(`category.${influencer.category}`)}</Badge>
              {influencer.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {influencer.city}
                </span>
              )}
              <span>·</span>
              <span>
                {t("profile.lastSynced")} {timeAgo(influencer.last_synced)}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {influencer.platforms.map((p) => (
                <a
                  key={p.id}
                  href={p.profile_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors hover:bg-secondary dark:border-border dark:hover:bg-secondary"
                >
                  <PlatformIcon
                    platform={p.platform}
                    className={cn("h-4 w-4", platformColor[p.platform])}
                  />
                  <span className="font-medium dark:text-foreground">
                    {formatNumber(p.followers_count)}
                  </span>
                </a>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-center">
              <div className="text-3xl font-bold text-success-foreground">
                {formatEr(influencer.engagement_rate)}
              </div>
              <div className="text-xs text-muted-foreground">{t("league.engagement")}</div>
            </div>
            {enableFavorite && (
              <Button
                variant={isFav ? "default" : "outline"}
                size="sm"
                onClick={toggleFav}
                className={cn(!isFav && "dark:border-border dark:text-foreground")}
              >
                <Heart className={cn("h-4 w-4", isFav && "fill-current")} />
                {isFav ? t("profile.removeFromFavorites") : t("profile.addToFavorites")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bio */}
      {influencer.bio && (
        <Card className="dark:bg-card dark:border-border">
          <CardContent className="p-6">
            <h2 className="mb-2 font-semibold">{t("profile.bio")}</h2>
            <p className="text-sm text-muted-foreground">{influencer.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Analytics — always visible */}
      <AnalyticsChart history={history} />

      {/* Locked sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ContactSection contact={influencer.contact} locked={locked} subscribeTo={subscribeTo} />
        <DiscountsSection
          discounts={influencer.discounts}
          locked={locked}
          subscribeTo={subscribeTo}
        />
      </div>
      <PricingSection prices={influencer.prices} locked={locked} subscribeTo={subscribeTo} />
    </div>
  );
}
