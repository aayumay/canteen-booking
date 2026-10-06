import { Link, useLocation } from "react-router-dom";
import { useCart } from "../../hooks/useCart.jsx";
import { useLanguage } from "../../contexts/LanguageContext.jsx";
import { formatMoney } from "../../lib/format.js";
import { playPop } from "../../lib/sounds.js";
import { resolveActiveNavKeyFor, STUDENT_NAV } from "./studentNav.jsx";

/**
 * Tablet/desktop navigation rail.
 *
 * Replaces the mobile bottom tab bar at >= 640px. Fixed to the left edge at
 * full viewport height. The cart lives here as a docked panel at the bottom
 * rather than as a floating bar over the content, because at these widths
 * there is room to give it a permanent home.
 *
 * Mounted only when the breakpoint hook reports tablet/desktop, so this never
 * renders on mobile.
 */
export default function SidebarNav({ onOpenCart }) {
  const { totalItems, subtotal } = useCart();
  const { t } = useLanguage();
  const { pathname } = useLocation();

  // One resolver, one winner: this rail used to rely on NavLink's built-in
  // prefix matching, and since every student route sits under "/student" the
  // Home item matched /student/orders too, lighting up two items at once.
  const activeKey = resolveActiveNavKeyFor(pathname);

  return (
    <nav className="sidenav" aria-label="Student main navigation">
      <ul className="sidenav-list">
        {STUDENT_NAV.map((item) => {
          const isCart = item.kind === "action";

          if (isCart) {
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className="sidenav-item"
                  onClick={() => {
                    playPop();
                    onOpenCart();
                  }}
                  aria-label={`${t(item.labelKey)}, ${totalItems} items`}
                >
                  <span className="sidenav-icon-wrap">
                    <svg
                      className="sidenav-svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      {item.icon}
                    </svg>
                    {totalItems > 0 && <span className="sidenav-badge mono">{totalItems}</span>}
                  </span>
                  <span className="sidenav-label">{t(item.labelKey)}</span>
                </button>
              </li>
            );
          }

          return (
            <li key={item.key}>
              <Link
                to={item.to}
                className={`sidenav-item ${
                  activeKey === item.key ? "sidenav-item-active" : ""
                }`}
                aria-current={activeKey === item.key ? "page" : undefined}
                onClick={() => playPop()}
              >
                <span className="sidenav-icon-wrap">
                  <svg
                    className="sidenav-svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </svg>
                </span>
                <span className="sidenav-label">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Docked cart summary — the tablet/desktop home for the cart. */}
      <div className="sidenav-cart">
        <div className="sidenav-cart-head">
          <span className="sidenav-cart-title">Your cart</span>
          {totalItems > 0 && <span className="sidenav-cart-count mono">{totalItems}</span>}
        </div>

        {totalItems > 0 ? (
          <>
            <div className="sidenav-cart-total mono">{formatMoney(subtotal)}</div>
            <button type="button" className="btn btn-primary sidenav-cart-cta" onClick={onOpenCart}>
              Checkout
            </button>
          </>
        ) : (
          <p className="sidenav-cart-empty">No items yet</p>
        )}
      </div>
    </nav>
  );
}
