import { Navigate, Outlet, useLocation } from "react-router-dom";
import ErrorState from "../components/common/ErrorState.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import { useAuth } from "../hooks/useAuth.js";

export function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "vendor") return "/vendor";
  return "/student";
}

export default function ProtectedRoute({ role }) {
  const { isAuthenticated, user, isSessionReady, sessionError, isRevalidating, retrySession } =
    useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!user) {
    // A token exists but no profile. Two very different causes:
    //  - the revalidation failed (usually offline) → the session may still be
    //    perfectly good, so offer a retry instead of dumping them at /login
    //  - the server actually rejected the token → the interceptor has already
    //    cleared it; send them to login with expired=1
    if (sessionError) {
      return (
        <div className="route-loader">
          <ErrorState
            error={sessionError}
            title="Couldn't verify your session"
            onRetry={isRevalidating ? undefined : retrySession}
            retryLabel={isRevalidating ? "Checking…" : "Try again"}
          />
        </div>
      );
    }
    return isSessionReady ? (
      <Navigate to="/login?expired=1" replace />
    ) : (
      <div className="route-loader">
        <Spinner size="lg" label="Restoring session" />
      </div>
    );
  }

  if (role && user.role !== role) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
