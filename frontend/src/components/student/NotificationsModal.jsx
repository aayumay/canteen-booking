import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Modal from "../common/Modal.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { Spinner } from "../common/Spinner.jsx";
import { announcementApi } from "../../api/announcementApi.js";
import { studentApi } from "../../api/studentApi.js";
import { walletApi } from "../../api/walletApi.js";
import { useAuth } from "../../hooks/useAuth.js";
import { formatTime } from "../../lib/format.js";
import { playPop } from "../../lib/sounds.js";

export function useNotificationCount() {
  const { isAuthenticated } = useAuth();

  const { data: announcements = [] } = useQuery({
    queryKey: ["activeAnnouncements"],
    queryFn: announcementApi.getActiveAnnouncements,
    refetchInterval: 60000,
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["studentOrders"],
    queryFn: studentApi.listMyOrders,
    enabled: isAuthenticated,
    refetchInterval: 15000,
  });

  const { data: wallet } = useQuery({
    queryKey: ["studentWallet"],
    queryFn: walletApi.getWallet,
    enabled: isAuthenticated,
  });

  const activeOrders = orders.filter((o) =>
    ["placed", "accepted", "preparing", "ready"].includes(o.status)
  );
  const lowBalanceCount = wallet?.is_low_balance ? 1 : 0;

  return announcements.length + activeOrders.length + lowBalanceCount;
}

export default function NotificationsModal({ open, onClose }) {
  const { isAuthenticated } = useAuth();

  const { data: announcements = [], isLoading: annLoading } = useQuery({
    queryKey: ["activeAnnouncements"],
    queryFn: announcementApi.getActiveAnnouncements,
    enabled: open,
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["studentOrders"],
    queryFn: studentApi.listMyOrders,
    enabled: open && isAuthenticated,
  });

  const { data: wallet } = useQuery({
    queryKey: ["studentWallet"],
    queryFn: walletApi.getWallet,
    enabled: open && isAuthenticated,
  });

  const activeOrders = orders.filter((o) =>
    ["placed", "accepted", "preparing", "ready"].includes(o.status)
  );

  const hasItems =
    announcements.length > 0 || activeOrders.length > 0 || wallet?.is_low_balance;

  const loading = annLoading || (isAuthenticated && ordersLoading);

  return (
    <Modal open={open} title="Notifications & Notices" onClose={onClose}>
      <div className="notifications-modal-content">
        {loading ? (
          <div className="center-row" style={{ padding: "24px 0" }}>
            <Spinner size="md" label="Loading alerts..." />
          </div>
        ) : !hasItems ? (
          /* Was a hand-rolled mascot block with inline styles — the one place
             the mascot was used in an empty state, and the reason EmptyState
             now uses it by default. Collapsed to the shared component so both
             read identically. */
          <EmptyState
            compact
            title="All Caught Up!"
            hint="No pending alerts or announcements right now. Enjoy your meals!"
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Active Live Orders Section */}
            {activeOrders.length > 0 && (
              <div className="notifications-section">
                <span className="notifications-section-title">
                  LIVE ORDERS ({activeOrders.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                  {activeOrders.map((order) => (
                    <Link
                      key={order.id}
                      to={`/student/orders?order=${order.id}`}
                      onClick={() => {
                        playPop();
                        onClose();
                      }}
                      className="notification-card notification-order-card"
                    >
                      <div className="notification-card-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="notification-card-body">
                        <div className="notification-card-head">
                          <strong className="notification-item-title">
                            Order #{order.id} • {order.pickup_token ? `Token ${order.pickup_token}` : "Pending"}
                          </strong>
                          <span className={`status-pill pill-${order.status}`}>
                            {order.status}
                          </span>
                        </div>
                        <span className="small muted">
                          Placed at {formatTime(order.created_at)} • Tap to track status
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Low Balance Warning */}
            {wallet?.is_low_balance && (
              <div className="notifications-section">
                <span className="notifications-section-title">WALLET NOTICE</span>
                <Link
                  to="/student/wallet"
                  onClick={() => {
                    playPop();
                    onClose();
                  }}
                  className="notification-card notification-warning-card"
                  style={{ marginTop: "6px" }}
                >
                  <div className="notification-card-icon warning">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B5651D" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <div className="notification-card-body">
                    <strong className="notification-item-title" style={{ color: "#94520B" }}>
                      Low Campus Wallet Balance
                    </strong>
                    <span className="small" style={{ color: "#7A4206" }}>
                      Your current balance is ₹{Number(wallet.balance || 0).toFixed(2)}. Visit campus admin to top up.
                    </span>
                  </div>
                </Link>
              </div>
            )}

            {/* Campus Announcements Section */}
            {announcements.length > 0 && (
              <div className="notifications-section">
                <span className="notifications-section-title">
                  CAMPUS ANNOUNCEMENTS ({announcements.length})
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                  {announcements.map((ann) => (
                    <div key={ann.id} className="notification-card">
                      <div className="notification-card-icon notice">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-forest)" strokeWidth="2">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                        </svg>
                      </div>
                      <div className="notification-card-body">
                        <strong className="notification-item-title">{ann.title}</strong>
                        <p className="small muted" style={{ margin: "4px 0 0" }}>
                          {ann.message}
                        </p>
                        {ann.created_at && (
                          <span className="small muted" style={{ fontSize: "11px", marginTop: "4px", display: "inline-block" }}>
                            {new Date(ann.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
