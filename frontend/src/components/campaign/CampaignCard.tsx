import { Calendar, DollarSign } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformIcon } from "@/components/icons";
import { StatusBadge } from "./DealStatusBadge";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD, formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types";
import type { ReactNode } from "react";

export function CampaignCard({
  campaign,
  footer,
  to,
}: {
  campaign: Campaign;
  footer?: ReactNode;
  to?: string;
}) {
  const { t } = useLanguage();
  // The header + body become a single clickable link to the detail page; the
  // footer (action buttons) stays outside so its own clicks aren't swallowed.
  const Body = to ? Link : "div";
  const bodyProps = to ? { to } : {};
  return (
    <Card className="flex flex-col dark:bg-card dark:border dark:border-border">
      <Body
        {...(bodyProps as { to: string })}
        className={cn("flex flex-1 flex-col", to && "transition-colors hover:bg-muted/40")}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{campaign.title}</CardTitle>
            <StatusBadge status={campaign.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary" className="gap-1 dark:bg-secondary dark:text-foreground">
              <PlatformIcon platform={campaign.platform} />
              {t(`platform.${campaign.platform}`)}
            </Badge>
            {campaign.category && (
              <Badge variant="secondary" className="dark:bg-secondary dark:text-foreground">
                {t(`category.${campaign.category}`)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <p className="line-clamp-2 text-sm text-muted-foreground">{campaign.description}</p>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1 font-medium">
              <DollarSign className="h-4 w-4 text-primary" />
              {formatUSD(campaign.budget_usd)}
            </span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              {formatDate(campaign.deadline)}
            </span>
          </div>
        </CardContent>
      </Body>
      {footer && <CardFooter className="gap-2">{footer}</CardFooter>}
    </Card>
  );
}
