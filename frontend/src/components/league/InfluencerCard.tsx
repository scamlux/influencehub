import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/icons";
import { useLanguage } from "@/hooks/useLanguage";
import { formatNumber, formatEr, initials, cn } from "@/lib/utils";
import type { InfluencerFull } from "@/types";

export function InfluencerCard({
  influencer,
  profileLink,
}: {
  influencer: InfluencerFull;
  profileLink: string;
}) {
  const { t } = useLanguage();
  return (
    <Link
      to={profileLink}
      className={cn(
        "group relative flex flex-col items-center rounded-xl border bg-card p-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:shadow-pink-500/15 dark:border-white/10 dark:bg-white/5 dark:shadow-xl dark:shadow-black/50 dark:backdrop-blur-sm dark:hover:border-primary/40",
        influencer.is_featured && "dark:ring-1 dark:ring-pink-500/30",
      )}
    >
      {influencer.is_featured && (
        <Badge className="absolute right-3 top-3 gap-1 gradient-primary border-0">
          <Star className="h-3 w-3" /> {t("league.featured")}
        </Badge>
      )}
      <Avatar className="h-20 w-20 ring-2 ring-primary/20">
        <AvatarImage src={influencer.avatar_url ?? undefined} />
        <AvatarFallback className="text-lg">{initials(influencer.display_name)}</AvatarFallback>
      </Avatar>
      <h3 className="mt-3 font-semibold group-hover:text-primary">{influencer.display_name}</h3>
      <Badge variant="secondary" className="mt-1">
        {t(`category.${influencer.category}`)}
      </Badge>
      <div className="mt-4 flex items-center gap-2">
        {influencer.platforms.map((p) => (
          <PlatformIcon key={p.id} platform={p.platform} />
        ))}
      </div>
      <div className="mt-4 grid w-full grid-cols-2 gap-2 border-t pt-4">
        <div>
          <div className="font-bold">{formatNumber(influencer.total_followers)}</div>
          <div className="text-xs text-muted-foreground">{t("league.followers")}</div>
        </div>
        <div>
          <div className="font-bold text-success-foreground dark:drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]">
            {formatEr(influencer.engagement_rate)}
          </div>
          <div className="text-xs text-muted-foreground">{t("league.engagement")}</div>
        </div>
      </div>
    </Link>
  );
}
