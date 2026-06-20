import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { PageLoader } from "./common";
import type { UserRole } from "@/types";

export function RoleGuard({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (!user.role) return <Navigate to="/choose-role" replace />;
  if (user.role !== role) return <Navigate to="/forbidden" replace />;

  return <>{children}</>;
}

export function dashboardPath(role: UserRole | null): string {
  switch (role) {
    case "brand":
      return "/brand/dashboard";
    case "influencer":
      return "/influencer/dashboard";
    case "admin":
      return "/admin/dashboard";
    default:
      return "/";
  }
}
