import { Link } from "react-router-dom";
import { Medal } from "lucide-react";
import { InfluencerAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/icons";
import { useLanguage } from "@/hooks/useLanguage";
import { formatNumber, formatEr, timeAgo, cn } from "@/lib/utils";
import type { InfluencerFull } from "@/types";

const medalColor = ["text-yellow-500", "text-slate-400", "text-amber-700"];

export function InfluencerRow({
  influencer,
  profileLink,
  selectable,
  selected,
  onToggleSelect,
}: {
  influencer: InfluencerFull;
  profileLink: string;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}) {
  const { t } = useLanguage();
  const rank = influencer.league_rank ?? 0;
  const rankBorder =
    rank === 1
      ? "border-l-4 border-l-yellow-400"
      : rank === 2
        ? "border-l-4 border-l-gray-400"
        : rank === 3
          ? "border-l-4 border-l-orange-400"
          : "";

  const socialIcons = (
    <>
      {/* first 2 always visible */}
      {influencer.platforms.slice(0, 2).map((p) => (
        <PlatformIcon key={p.id} platform={p.platform} />
      ))}
      {/* the rest: visible from md up, collapsed into a +N pill on mobile */}
      {influencer.platforms.slice(2).map((p) => (
        <span key={p.id} className="hidden md:inline-flex">
          <PlatformIcon platform={p.platform} />
        </span>
      ))}
      {influencer.platforms.length > 2 && (
        <span className="text-xs font-medium text-muted-foreground md:hidden">
          +{influencer.platforms.length - 2}
        </span>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b px-4 py-4 transition-colors hover:bg-secondary/40 dark:bg-card dark:border-border dark:hover:bg-secondary sm:flex-row sm:items-center",
        rankBorder,
        selected && "bg-primary/5",
      )}
    >
      <div className="flex flex-1 items-center gap-4">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 accent-[hsl(330,100%,60%)] dark:border-border"
            aria-label="Select for comparison"
          />
        )}
        <div className="flex w-8 shrink-0 items-center justify-center">
          {rank <= 3 ? (
            <Medal className={cn("h-6 w-6", medalColor[rank - 1])} />
          ) : (
            <span className="text-sm font-bold text-muted-foreground">{rank}</span>
          )}
        </div>
        <InfluencerAvatar
          name={influencer.display_name}
          avatarUrl={influencer.avatar_url}
          platforms={influencer.platforms}
          className="h-12 w-12"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Link to={profileLink} className="truncate font-semibold hover:text-primary">
              {influencer.display_name}
            </Link>
            {influencer.is_featured && (
              <Badge className="gradient-primary border-0">{t("league.featured")}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{influencer.city}</span>
            <span>·</span>
            <Badge variant="secondary" className="dark:bg-secondary dark:text-foreground">
              {t(`category.${influencer.category}`)}
            </Badge>
            <span className="hidden md:inline">·</span>
            <span className="hidden md:inline">{timeAgo(influencer.last_synced)}</span>
          </div>
        </div>
      </div>

      {/* Mobile: social icons + stats in one compact row */}
      <div className="flex items-center justify-between px-0 sm:hidden">
        <div className="flex items-center gap-1.5">{socialIcons}</div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex flex-col items-end">
            <span className="font-bold">{formatNumber(influencer.total_followers)}</span>
            <span className="text-xs text-muted-foreground">{t("league.followers")}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-bold text-success-foreground">
              {formatEr(influencer.engagement_rate)}
            </span>
            <span className="text-xs text-muted-foreground">{t("league.engagement")}</span>
          </div>
        </div>
      </div>

      {/* Desktop/tablet: original horizontal columns */}
      <div className="hidden items-center gap-1.5 sm:flex">{socialIcons}</div>

      <div className="hidden w-28 flex-col text-right sm:flex">
        <span className="font-semibold">{formatNumber(influencer.total_followers)}</span>
        <span className="text-xs text-muted-foreground">{t("league.followers")}</span>
      </div>

      <div className="hidden w-20 flex-col text-right sm:flex">
        <span className="font-semibold text-success-foreground">
          {formatEr(influencer.engagement_rate)}
        </span>
        <span className="text-xs text-muted-foreground">{t("league.engagement")}</span>
      </div>

      <Button
        asChild
        variant="outline"
        size="sm"
        className="bg-primary text-white hover:bg-primary/90 sm:bg-transparent sm:text-foreground sm:hover:bg-secondary dark:border-border dark:sm:text-foreground"
      >
        <Link to={profileLink}>{t("league.viewProfile")}</Link>
      </Button>
    </div>
  );
}
