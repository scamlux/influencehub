import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { timeAgo } from "@/lib/utils";
import type { ScrapingQueueItem, ScrapingStatus } from "@/types";

const statusVariant: Record<ScrapingStatus, BadgeProps["variant"]> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  failed: "destructive",
};

export function ScrapingQueueTable({
  items,
  nameFor,
}: {
  items: ScrapingQueueItem[];
  nameFor: (influencerId: string) => string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Influencer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Error</TableHead>
          <TableHead>Queued</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{nameFor(item.influencer_id)}</TableCell>
            <TableCell>
              <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
            </TableCell>
            <TableCell className="text-sm text-destructive">{item.error ?? "—"}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {timeAgo(item.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
