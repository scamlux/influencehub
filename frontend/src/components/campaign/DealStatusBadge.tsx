import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { BidStatus, CampaignStatus, DealStatus } from "@/types";

const map: Record<string, { variant: BadgeProps["variant"]; label: string; className?: string }> = {
  // deal
  active: { variant: "default", label: "Active" },
  content_submitted: { variant: "secondary", label: "Content Submitted" },
  approved: { variant: "success", label: "Approved" },
  completed: { variant: "success", label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  // bid
  pending: { variant: "secondary", label: "Pending" },
  accepted: { variant: "success", label: "Accepted" },
  rejected: { variant: "destructive", label: "Rejected" },
  // campaign
  open: {
    variant: "default",
    label: "Open",
    className: "dark:bg-green-900/30 dark:text-green-400",
  },
  draft: { variant: "muted", label: "Draft" },
};

export function StatusBadge({ status }: { status: DealStatus | BidStatus | CampaignStatus }) {
  const cfg = map[status] ?? { variant: "secondary" as const, label: status };
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
