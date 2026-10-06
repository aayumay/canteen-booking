import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import { studentApi } from "../../api/studentApi.js";
import { useOrderStatus } from "../../hooks/useOrderStatus.js";
import { formatTime, formatMoney } from "../../lib/format.js";
import ReviewBottomSheet from "./ReviewBottomSheet.jsx";
import { Spinner } from "../common/Spinner.jsx";
import "./vintageTicket.css";

const ORDER_STAGES = [
  {
    key: "placed",
    label: "Placed",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    key: "accepted",
    label: "Accepted",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    key: "preparing",
    label: "Cooking",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2c1.5 3 4 4.5 4 8.5a6 6 0 1 1-12 0c0-4 2.5-5.5 4-8.5 0 2.5 1.5 3.5 2.5 3.5s2.5-1 1.5-3.5z" />
      </svg>
    ),
  },
  {
    key: "ready",
    label: "Ready",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    key: "picked_up",
    label: "Picked Up",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

export default function OrderTicket({ order: initialOrder, highlight = false }) {
  const queryClient = useQueryClient();
  const [cancelError, setCancelError] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [submittedReview, setSubmittedReview] = useState(null);

  const { order: liveOrder, isStale, isRefreshing, lastSyncedAt, refresh } = useOrderStatus(
    initialOrder?.id,
    studentApi.getMyOrder,
    initialOrder
  );
  const order = liveOrder || initialOrder;

  const cancelMutation = useMutation({
    mutationFn: () => studentApi.cancelOrder(order.id),
    onSuccess: () => {
      setCancelError(null);
      queryClient.invalidateQueries({ queryKey: ["studentOrders"] });
      queryClient.invalidateQueries({ queryKey: ["orderStatus", order.id] });
    },
    onError: (err) => setCancelError(err),
  });

  const isLive = !["picked_up", "rejected", "cancelled"].includes(order.status);
  const isTerminalNegative = order.status === "rejected" || order.status === "cancelled";
  const canCancel = order.status === "placed";

  const hasReview = Boolean(order.review || submittedReview);
  const reviewData = order.review || submittedReview;

  const stageIndex = ORDER_STAGES.findIndex((s) => s.key === order.status);
  const activeIndex = stageIndex >= 0 ? stageIndex : 0;

  const qrPayload = JSON.stringify({
    order_id: String(order.id ?? ""),
    pickup_token: String(order.pickup_token ?? ""),
  });

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="vintage-ticket"
    >
      {/* HEADER */}
      <div className="vt-header">
        <div>
          <h3 className="vt-vendor-name">{order.vendor_name || "Canteen Stall"}</h3>
          <div className="vt-meta">
            <span>{formatTime(order.created_at)}</span>
            <span>
              {order.payment_method === "wallet"
                ? "Campus Wallet"
                : order.payment_method === "meal_plan"
                ? "Meal Pass"
                : "Pay at Counter"}
            </span>
          </div>
        </div>
        <div className="vt-status-pill">{order.status.replace("_", " ")}</div>
      </div>

      {/* STALE BANNER (Optional) */}
      {isStale && (
        <div className="vt-stale-banner">
          <span>Status may be out of date.</span>
          <button type="button" className="vt-stale-btn" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      )}

      {/* FIRST DIVIDER WITH HOLE PUNCHES */}
      <div className="vt-divider-wrap">
        <div className="vt-cutout vt-cutout-left" />
        <div className="vt-divider-line" />
        <div className="vt-cutout vt-cutout-right" />
      </div>

      {/* TRACKER */}
      {!isTerminalNegative && (
        <div className="vt-section" style={{ paddingBottom: "24px" }}>
          <div className="vt-tracker-head">
            <h4 className="vt-tracker-title">Order Progress</h4>
            {/* Mascot Stamp */}
            <svg
              width="20"
              height="20"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <mask id="vtBiteMask">
                <rect width="100" height="100" fill="white" />
                <circle cx="82" cy="28" r="22" fill="black" />
                <circle cx="70" cy="18" r="7" fill="black" />
                <circle cx="76" cy="36" r="7" fill="black" />
                <circle cx="88" cy="46" r="7" fill="black" />
              </mask>
              <circle cx="50" cy="50" r="44" fill="#C9B98A" mask="url(#vtBiteMask)" />
              <path
                d="M 50 6 C 25.7 6 6 25.7 6 50 C 6 74.3 25.7 94 50 94 C 74.3 94 94 74.3 94 50"
                stroke="#4A3728"
                strokeWidth="6"
                fill="none"
                mask="url(#vtBiteMask)"
              />
              <circle cx="38" cy="42" r="5.5" fill="#4A3728" />
              <path d="M 32 54 Q 44 64 56 52" stroke="#4A3728" strokeWidth="4" strokeLinecap="round" fill="none" />
            </svg>
          </div>

          <div className="vt-tracker-row">
            <div className="vt-tracker-rail" />
            {ORDER_STAGES.map((st, idx) => {
              const isCompleted = idx < activeIndex;
              const isCurrent = idx === activeIndex;
              return (
                <div key={st.key} className={`vt-tracker-node ${isCompleted ? "vt-completed" : ""} ${isCurrent ? "vt-current" : ""}`}>
                  {st.icon}
                  <span className="vt-tracker-label">{st.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TERMINAL NEGATIVE STATE */}
      {isTerminalNegative && (
        <div className="vt-section" style={{ textAlign: "center", color: "#E85D4C", fontWeight: 700 }}>
          <p>Order {order.status === "rejected" ? "Rejected" : "Cancelled"}</p>
          {order.rejection_reason && <p style={{ fontSize: "0.8rem", marginTop: "4px" }}>{order.rejection_reason}</p>}
        </div>
      )}

      {/* PICKUP TOKEN (Only if live) */}
      {isLive && order.pickup_token && (
        <>
          <div className="vt-divider-wrap"><div className="vt-divider-line" /></div>
          <div className="vt-section vt-token-section">
            <div className="vt-token-info">
              <span className="vt-token-label">Pickup token</span>
              <span className="vt-token-digits">{order.pickup_token}</span>
              <span className="vt-token-hint">Show this code or QR at the counter.</span>
            </div>
            <div className="vt-token-qr" onClick={() => setShowQRModal(true)} style={{ cursor: "pointer" }}>
              <QRCodeSVG value={qrPayload} size={48} level="M" fgColor="#4A3728" bgColor="#FBF8F0" />
            </div>
          </div>
        </>
      )}

      {/* ITEM LIST */}
      {order.items && order.items.length > 0 && (
        <>
          <div className="vt-divider-wrap"><div className="vt-divider-line" /></div>
          <div className="vt-section" style={{ paddingTop: "12px", paddingBottom: "12px" }}>
            {order.items.map((it) => (
              <div key={it.id} className="vt-item-row">
                <span className="vt-item-name">{it.item_name}</span>
                <span className="vt-item-qty">x{it.quantity}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* FOOTER */}
      <div className="vt-divider-wrap"><div className="vt-divider-line" /></div>
      <div className="vt-section vt-footer">
        <div className="vt-total">Total: <strong>{formatMoney(order.total_amount)}</strong></div>
        
        {canCancel && (
          <button
            type="button"
            className="vt-btn-danger"
            onClick={() => cancelMutation.mutate()}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? "Canceling..." : "Cancel Order"}
          </button>
        )}

        {/* Rate Order CTA */}
        {order.status === "picked_up" && !hasReview && (
          <button
            type="button"
            className="vt-btn-primary"
            onClick={() => setShowReviewSheet(true)}
          >
            Rate this order
          </button>
        )}

        {order.status === "picked_up" && hasReview && (
          <span className="vt-status-pill" style={{ borderColor: "#4A7D46", color: "#4A7D46" }}>
            Rated {reviewData.rating}/5
          </span>
        )}
      </div>

      {cancelError && (
        <div className="vt-section" style={{ paddingTop: 0, color: "#E85D4C", fontSize: "0.8rem", textAlign: "center" }}>
          {cancelError.message}
        </div>
      )}

      {/* Review Bottom Sheet */}
      <ReviewBottomSheet
        order={order}
        open={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
        onSuccess={(review) => {
          setSubmittedReview(review);
        }}
      />

      {/* Fullscreen QR Zoom Modal */}
      <AnimatePresence>
        {showQRModal && (
          <div className="modal-backdrop" onClick={() => setShowQRModal(false)}>
            <motion.div
              className="modal-card qr-zoom-modal center-text"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              style={{ background: "#F1E4C0", color: "#4A3728", border: "2px dashed #8B7355" }}
            >
              <h3 className="modal-title" style={{ color: "#4A3728" }}>Pickup Token #{order.pickup_token}</h3>
              <p className="muted small" style={{ marginBottom: "16px", color: "#8B7355" }}>
                Scan at counter for instant verification
              </p>
              <div className="qr-fullscreen-wrap" style={{ background: "#FBF8F0", padding: "16px", borderRadius: "12px", display: "inline-block" }}>
                <QRCodeSVG value={qrPayload} size={200} level="M" fgColor="#4A3728" bgColor="#FBF8F0" />
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ marginTop: "24px", background: "#4A3728", color: "#F1E4C0", border: "none" }}
                onClick={() => setShowQRModal(false)}
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}
