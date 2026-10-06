import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth.js";
import { useLanguage } from "../../contexts/LanguageContext.jsx";
import { useHasSidebar } from "../../hooks/useBreakpoint.js";
import { CartProvider, useCart } from "../../hooks/useCart.jsx";
import { AnnouncementBanner } from "../common/AnnouncementBanner.jsx";
import { DoodleBrandMark } from "../common/doodles.jsx";
import CartBar from "./CartBar.jsx";
import SidebarNav from "./SidebarNav.jsx";
import CheckoutSheet from "./CheckoutSheet.jsx";
import { resolveActiveNavKeyFor, STUDENT_NAV } from "./studentNav.jsx";
import { playPop } from "../../lib/sounds.js";

function StudentLayoutInner() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { totalItems } = useCart();
  const hasSidebar = useHasSidebar();
  const [openCartSheet, setOpenCartSheet] = useState(false);

  // Shared with the tablet/desktop rail, so the two can never disagree about
  // which item is active. This used to be a second, hand-rolled copy of the
  // match rules living in this file.
  const activeKey = resolveActiveNavKeyFor(pathname);

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const openCart = () => setOpenCartSheet(true);

  return (
    <div className={`app-shell ${hasSidebar ? "app-shell--rail" : ""}`}>
      {/* Tablet/desktop only: fixed left rail. Replaces the bottom tab bar. */}
      {hasSidebar && <SidebarNav onOpenCart={openCart} />}

      <header className="appbar">
        <NavLink to="/student" end className="brand">
          <DoodleBrandMark size={24} className="brand-mark" />
          Canteen<span className="brand-accent">Booking</span>
        </NavLink>
        <div className="topbar-user" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <NavLink to="/student/profile" end className="topbar-name">
            {user?.name ?? "Student"}
          </NavLink>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            {t("logout")}
          </button>
        </div>
      </header>

      <main className="page">
        <AnnouncementBanner />
        <Outlet />
      </main>

      {/* Floating cart bar is a mobile affordance; the rail has a docked cart
          panel instead, so it is not rendered at tablet and up. */}
      {!hasSidebar && <CartBar onOpenCart={openCart} />}

      {/* Mobile only: 4-tab bottom navigation. */}
      {!hasSidebar && (
        <nav className="tabbar" aria-label="Student main navigation">
          {STUDENT_NAV.map((item) =>
            item.kind === "action" ? (
              <button
                key={item.key}
                type="button"
                className="tabbar-nav-item"
                onClick={() => {
                  playPop();
                  openCart();
                }}
              >
                <div className="tabbar-cart-icon-wrap">
                  <svg className="tabbar-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    {item.icon}
                  </svg>
                  {totalItems > 0 && <span className="tabbar-cart-badge mono">{totalItems}</span>}
                </div>
                <span className="tabbar-label">{t(item.labelKey)}</span>
              </button>
            ) : (
              <Link
                key={item.key}
                to={item.to}
                className={`tabbar-nav-item ${
                  activeKey === item.key ? "tabbar-nav-active" : ""
                }`}
                aria-current={activeKey === item.key ? "page" : undefined}
                onClick={() => playPop()}
              >
                <svg className="tabbar-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {item.icon}
                </svg>
                <span className="tabbar-label">{t(item.labelKey)}</span>
              </Link>
            )
          )}
        </nav>
      )}

      {/* Single checkout surface for every entry point (tab bar, floating bar,
          sidebar panel). */}
      <CheckoutSheet open={openCartSheet} onClose={() => setOpenCartSheet(false)} />
    </div>
  );
}

export default function StudentLayout() {
  return (
    <CartProvider>
      <StudentLayoutInner />
    </CartProvider>
  );
}
