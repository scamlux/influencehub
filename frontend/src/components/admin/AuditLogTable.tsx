import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AdminAction } from "@/types";

export function AuditLogTable({ actions }: { actions: AdminAction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Action</TableHead>
          <TableHead>Target Table</TableHead>
          <TableHead>Target ID</TableHead>
          <TableHead>Details</TableHead>
          <TableHead>When</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {actions.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <Badge variant="secondary">{a.action_type}</Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{a.target_table}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {a.target_id.slice(0, 8)}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
              {a.details ? JSON.stringify(a.details) : "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(a.created_at)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
