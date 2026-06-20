import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { dashboardPath } from "@/components/RoleGuard";
import { Spinner } from "@/components/common";

/**
 * OAuth callback handler. In a live Supabase setup this is where the session
 * from the OAuth redirect is exchanged. In mock mode we simply route the user
 * based on whether they already have a role.
 */
export default function AuthCallback() {
  const { user, loading, refresh } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", { replace: true });
    else if (!user.role) navigate("/choose-role", { replace: true });
    else navigate(dashboardPath(user.role), { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
