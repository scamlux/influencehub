import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { BidStatus, CampaignStatus, DealStatus } from "@/types";

const map: Record<string, { variant: BadgeProps["variant"]; label: string; className?: string }> = {
  // deal — marketplace flow
  active: { variant: "default", label: "Active" },
  content_submitted: { variant: "secondary", label: "Content Submitted" },
  approved: { variant: "success", label: "Approved" },
  completed: { variant: "success", label: "Completed" },
  cancelled: { variant: "destructive", label: "Cancelled" },
  // deal — escrow flow (T-13)
  funded: { variant: "default", label: "Funded" },
  in_progress: { variant: "secondary", label: "In Progress" },
  delivered: { variant: "secondary", label: "Delivered" },
  released: { variant: "success", label: "Released" },
  disputed: { variant: "destructive", label: "Disputed" },
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
