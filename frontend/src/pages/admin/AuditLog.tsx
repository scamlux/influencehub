import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common";
import { AuditLogTable } from "@/components/admin/AuditLogTable";
import { admin } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import type { AdminAction } from "@/types";

export default function AdminAuditLog() {
  const { t } = useLanguage();
  const [actions, setActions] = useState<AdminAction[]>([]);

  useEffect(() => {
    admin.auditLog().then((a) => setActions(a as AdminAction[]));
  }, []);

  return (
    <div>
      <PageHeader title={t("nav.auditLog")} subtitle={`${actions.length} actions`} />
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <AuditLogTable actions={actions} />
      </div>
    </div>
  );
}
