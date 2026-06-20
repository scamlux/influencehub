import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "./common";
import { dashboardPath } from "./RoleGuard";

/**
 * Wraps auth-only pages (login / register). Authenticated users are bounced to
 * their dashboard instead of being shown the form again.
 */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (user) return <Navigate to={dashboardPath(user.role)} replace />;
  return <>{children}</>;
}
