import { lazy, Suspense } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import { Spinner } from "./components/common/Spinner.jsx";
import Login from "./pages/Login.jsx";
import StudentMenu from "./pages/StudentMenu.jsx";
import StudentOrders from "./pages/StudentOrders.jsx";
import StudentProfile from "./pages/StudentProfile.jsx";
import StudentWallet from "./pages/StudentWallet.jsx";
import StudentLayout from "./components/student/StudentLayout.jsx";
import ProtectedRoute, { homeForRole } from "./routes/ProtectedRoute.jsx";
import { useAuth } from "./hooks/useAuth.js";

/* The landing page carries all of the marketing motion and photography, and the
   admin console is a large screen that most students never open. Both are split
   out of the main bundle so the app shell stays small on first paint. */
const Landing = lazy(() => import("./pages/Landing.jsx"));
const VendorDashboard = lazy(() => import("./pages/VendorDashboard.jsx"));
const VendorScan = lazy(() => import("./pages/VendorScan.jsx"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard.jsx"));
const StudentMealPlans = lazy(() => import("./pages/StudentMealPlans.jsx"));
const StudentSchedule = lazy(() => import("./pages/StudentSchedule.jsx"));
const StudentLeaderboard = lazy(() => import("./pages/StudentLeaderboard.jsx"));
/* Layout study, not the production marketing page. Lazy so its stylesheet and
   Tailwind utilities only load for someone who actually opens /scrapbook. */
const Scrapbook = lazy(() => import("./pages/Scrapbook.jsx"));

function RouteFallback() {
  return (
    <div className="route-loader">
      <Spinner size="lg" label="Loading" />
    </div>
  );
}

/** Signed-in users skip the marketing page and land in their own portal. */
function RoleRedirect() {
  const { isAuthenticated, user, isSessionReady } = useAuth();
  if (!isAuthenticated) return <Navigate to="/landing" replace />;
  if (!user) {
    return isSessionReady ? (
      <Navigate to="/landing" replace />
    ) : (
      <div className="route-loader">
        <Spinner size="lg" label="Restoring session" />
      </div>
    );
  }
  return <Navigate to={homeForRole(user.role)} replace />;
}

function NotFound() {
  return (
    <div className="auth-shell">
      <div className="auth-panel center-text">
        <h1 className="page-title">404</h1>
        <p className="muted">That page isn't on the menu.</p>
        <Link className="btn btn-primary" to="/landing">
          Back to the counter
        </Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/scrapbook" element={<Scrapbook />} />
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute role="student" />}>
            <Route element={<StudentLayout />}>
              <Route path="/student" element={<StudentMenu />} />
              <Route path="/student/vendors/:vendorId" element={<StudentMenu />} />
              <Route path="/student/orders" element={<StudentOrders />} />
              <Route path="/student/wallet" element={<StudentWallet />} />
              <Route
                path="/student/meal-plans"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentMealPlans />
                  </Suspense>
                }
              />
              <Route
                path="/student/schedule"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentSchedule />
                  </Suspense>
                }
              />
              <Route
                path="/student/leaderboard"
                element={
                  <Suspense fallback={<RouteFallback />}>
                    <StudentLeaderboard />
                  </Suspense>
                }
              />
              <Route path="/student/profile" element={<StudentProfile />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="vendor" />}>
            <Route
              path="/vendor"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <VendorDashboard />
                </Suspense>
              }
            />
            <Route
              path="/vendor/scan"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <VendorScan />
                </Suspense>
              }
            />
          </Route>

          <Route element={<ProtectedRoute role="admin" />}>
            <Route
              path="/admin"
              element={
                <Suspense fallback={<RouteFallback />}>
                  <AdminDashboard />
                </Suspense>
              }
            />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
