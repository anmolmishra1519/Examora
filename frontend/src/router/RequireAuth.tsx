import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Spinner } from "@/components/ui/Badges";
import type { Role } from "@/types";

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="text-navy-500" size={28} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === "faculty" ? "/faculty" : "/student"} replace />;
  }
  return <Outlet />;
}
