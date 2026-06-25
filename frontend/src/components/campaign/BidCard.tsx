import { InfluencerAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./DealStatusBadge";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD } from "@/lib/utils";
import type { Bid, InfluencerFull } from "@/types";

export function BidCard({
  bid,
  influencer,
  onAccept,
  onReject,
}: {
  bid: Bid;
  influencer?: InfluencerFull;
  onAccept?: () => void;
  onReject?: () => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <InfluencerAvatar
            name={influencer?.display_name ?? "?"}
            avatarUrl={influencer?.avatar_url}
            platforms={influencer?.platforms}
            seed={influencer?.id}
          />
          <div>
            <p className="font-semibold">{influencer?.display_name ?? "Influencer"}</p>
            <p className="text-xs text-muted-foreground">
              {influencer?.city} · {influencer && t(`category.${influencer.category}`)}
            </p>
          </div>
        </div>
        <StatusBadge status={bid.status} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{bid.proposal}</p>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="font-semibold text-primary">{formatUSD(bid.proposed_price)}</span>
        <span className="text-muted-foreground">{bid.delivery_days} days delivery</span>
      </div>
      {bid.status === "pending" && (onAccept || onReject) && (
        <div className="mt-4 flex gap-2">
          {onAccept && (
            <Button size="sm" onClick={onAccept}>
              {t("campaigns.acceptBid")}
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="outline" onClick={onReject}>
              {t("campaigns.rejectBid")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
