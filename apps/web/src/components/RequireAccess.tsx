import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminRole } from "@/hooks/useAdminRole";
import type { RouteAccess } from "@/routes/routeAccess";

interface RequireAccessProps {
  access: Exclude<RouteAccess, "public">;
  children: React.ReactNode;
}

const Spinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

/**
 * Client-side route gate. Waits for both auth and role resolution before
 * redirecting, so a slow role lookup never bounces a legitimate user.
 */
export const RequireAccess = ({ access, children }: RequireAccessProps) => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, isVenueManager, loading: roleLoading } = useAdminRole(user);
  const location = useLocation();

  if (authLoading) return <Spinner />;

  if (!user) {
    const target = access === "admin" ? "/super-admin-login" : access === "venueManager" ? "/admin_signin" : "/auth";
    return <Navigate to={target} state={{ from: location.pathname + location.search }} replace />;
  }

  if (access === "authenticated") return <>{children}</>;

  if (roleLoading) return <Spinner />;

  if (access === "admin" && !isAdmin) return <Navigate to="/venues" replace />;
  if (access === "venueManager" && !isVenueManager && !isAdmin) {
    return <Navigate to="/venues" replace />;
  }

  return <>{children}</>;
};
