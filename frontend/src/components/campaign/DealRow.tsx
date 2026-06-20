import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "./DealStatusBadge";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD, formatDate } from "@/lib/utils";
import type { Deal } from "@/types";

export function DealRow({
  deal,
  counterpartyName,
  role,
  chatBase,
  onSubmitContent,
  onSetStatus,
}: {
  deal: Deal;
  counterpartyName: string;
  role: "brand" | "influencer";
  chatBase: string;
  onSubmitContent?: (url: string) => void;
  onSetStatus?: (status: Deal["status"]) => void;
}) {
  const { t } = useLanguage();
  const [url, setUrl] = useState("");
  const [showInput, setShowInput] = useState(false);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{counterpartyName}</span>
              <StatusBadge status={deal.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("deals.agreedPrice")}:{" "}
              <span className="font-medium text-foreground">{formatUSD(deal.agreed_price)}</span>
              {" · "}
              {formatDate(deal.created_at)}
            </p>
            {deal.content_url && (
              <a
                href={deal.content_url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-sm text-primary hover:underline"
              >
                {deal.content_url}
              </a>
            )}
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={`${chatBase}/${deal.id}`}>
              <MessageSquare className="h-4 w-4" /> {t("deals.openChat")}
            </Link>
          </Button>
        </div>

        {/* Influencer actions */}
        {role === "influencer" && deal.status === "active" && (
          <div className="mt-4 border-t pt-4">
            {showInput ? (
              <div className="flex gap-2">
                <Input
                  placeholder={t("deals.contentUrl")}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={!url.trim()}
                  onClick={() => {
                    onSubmitContent?.(url.trim());
                    setShowInput(false);
                    setUrl("");
                  }}
                >
                  {t("common.submit")}
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => setShowInput(true)}>
                {t("deals.submitContent")}
              </Button>
            )}
          </div>
        )}

        {/* Brand actions */}
        {role === "brand" && (
          <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
            {deal.status === "content_submitted" && (
              <Button size="sm" onClick={() => onSetStatus?.("approved")}>
                {t("deals.approveContent")}
              </Button>
            )}
            {deal.status === "approved" && (
              <Button size="sm" onClick={() => onSetStatus?.("completed")}>
                {t("deals.markComplete")}
              </Button>
            )}
            {["active", "content_submitted", "approved"].includes(deal.status) && (
              <Button size="sm" variant="outline" onClick={() => onSetStatus?.("cancelled")}>
                {t("deals.cancel")}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
