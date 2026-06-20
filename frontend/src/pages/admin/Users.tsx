import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, EmptyState } from "@/components/common";
import { Pagination, usePagination } from "@/components/ui/pagination";
import { admin } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import type { UserRole } from "@/types";

type AdminUser = Awaited<ReturnType<typeof admin.allUsers>>[number];

export default function AdminUsers() {
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AdminUser[]>([]);

  const refresh = useCallback(() => {
    admin.allUsers().then(setUsers);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    );
  }, [users, query]);

  const { current, page, pageCount, next, prev, reset } = usePagination(filtered, 10);

  return (
    <div>
      <PageHeader title={t("nav.users")} subtitle={`${users.length} total`} />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            reset();
          }}
          placeholder={t("common.searchByNameEmail")}
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("auth.fullName")}</TableHead>
              <TableHead>{t("auth.email")}</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {current.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState icon={Search} title={t("common.noMatches")} />
                </TableCell>
              </TableRow>
            ) : (
              current.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Select
                      value={u.role ?? undefined}
                      onValueChange={async (v) => {
                        await admin.setUserRole(u.id, v as UserRole);
                        refresh();
                      }}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="brand">{t("auth.brand")}</SelectItem>
                        <SelectItem value="influencer">{t("auth.influencer")}</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.is_active ? "success" : "warning"}>
                      {u.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant={u.is_active ? "outline" : "default"}
                      size="sm"
                      onClick={async () => {
                        await admin.toggleActive(u.id);
                        refresh();
                      }}
                    >
                      {u.is_active ? t("common.deactivate") : t("common.activate")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageCount={pageCount} onPrev={prev} onNext={next} />
    </div>
  );
}
