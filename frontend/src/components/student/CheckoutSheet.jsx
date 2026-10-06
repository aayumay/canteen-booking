import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { studentApi } from "../../api/studentApi.js";
import { walletApi } from "../../api/walletApi.js";
import { mealPlanApi } from "../../api/mealPlanApi.js";
import { useCart } from "../../hooks/useCart.jsx";
import { useBreakpoint } from "../../hooks/useBreakpoint.js";
import { formatMoney } from "../../lib/format.js";
import { Spinner } from "../common/Spinner.jsx";
import EmptyState from "../common/EmptyState.jsx";
import PickupToken from "./PickupToken.jsx";
import { playPop, playSuccess } from "../../lib/sounds.js";
import { prefersReducedMotion } from "../landing/motion.jsx";

const VALID_PROMOS = {
  STUDENT50: { discount: 50, type: "flat", desc: "₹50 Off Student Special" },
  FIRSTBITE: { discount: 0.2, type: "percent", desc: "20% Off Canteen Discount" },
  CRAVINGS: { discount: 30, type: "flat", desc: "₹30 Off Midnight Snack" },
};

export default function CheckoutSheet({ open, onClose }) {
  const { items, subtotal, vendorId, vendorName, clear, increment, decrement, removeItem } = useCart();
  const isMobile = useBreakpoint() === "mobile";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [selectedSlotId, setSelectedSlotId] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("wallet"); // "wallet" | "pay_at_counter" | "meal_plan"
  const [cutleryNeeded, setCutleryNeeded] = useState(true);
  const [reusableContainer, setReusableContainer] = useState(false);
  const [notes, setNotes] = useState("");
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState("");
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const { data: wallet } = useQuery({
    queryKey: ["studentWallet"],
    queryFn: walletApi.getWallet,
    enabled: open,
  });

  const { data: slots = [] } = useQuery({
    queryKey: ["vendorSlots", vendorId],
    queryFn: () => (vendorId ? studentApi.getVendorSlots(vendorId) : Promise.resolve([])),
    enabled: Boolean(vendorId && open),
  });

  const { data: myMealPlans = [] } = useQuery({
    queryKey: ["myMealPlans"],
    queryFn: mealPlanApi.getMySubscriptions,
    enabled: Boolean(open),
  });

  const activeMealPlan = myMealPlans.find(
    (p) =>
      p.meal_plan?.vendor_id === vendorId &&
      p.meals_remaining > 0 &&
      new Date(p.expires_at) > new Date()
  );

  const walletBalance = wallet?.balance ?? 0.0;

  const calculateDiscount = () => {
    if (!appliedPromo) return 0;
    const promo = VALID_PROMOS[appliedPromo];
    if (!promo) return 0;
    if (promo.type === "flat") return Math.min(promo.discount, subtotal);
    if (promo.type === "percent") return Math.round(subtotal * promo.discount);
    return 0;
  };

  const promoDiscountAmount = calculateDiscount();
  const ecoDiscountAmount = reusableContainer ? Math.min(5, Math.max(0, subtotal - promoDiscountAmount)) : 0;
  const totalDiscount = promoDiscountAmount + ecoDiscountAmount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);
  const isInsufficientWallet = paymentMethod === "wallet" && walletBalance < finalTotal;

  const checkoutMutation = useMutation({
    mutationFn: studentApi.placeOrder,
    onSuccess: (order) => {
      // Trigger haptic / sound & celebration confetti!
      playSuccess();
      // canvas-confetti draws to its own canvas outside the React tree, so the
      // global reduced-motion stylesheet never touches it. Respect the
      // preference here or a vestibular trigger fires on every checkout.
      if (!prefersReducedMotion()) {
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ["#A6E22E", "#F2994A", "#FFFFFF"],
          });
        } catch {
          // ignore
        }
      }

      setConfirmedOrder(order);
      clear();
      queryClient.invalidateQueries({ queryKey: ["studentOrders"] });
      queryClient.invalidateQueries({ queryKey: ["studentWallet"] });
      queryClient.invalidateQueries({ queryKey: ["vendorSlots", vendorId] });
    },
  });

  const handleApplyPromo = (e) => {
    e.preventDefault();
    setPromoError("");
    const code = promoInput.trim().toUpperCase();
    if (!code) return;
    if (VALID_PROMOS[code]) {
      setAppliedPromo(code);
      setPromoInput("");
      playPop();
    } else {
      setPromoError("Invalid code. Try STUDENT50 or CRAVINGS");
    }
  };

  const handleConfirm = () => {
    if (items.length === 0 || !vendorId) return;
    if (isInsufficientWallet) return;
    playPop();
    checkoutMutation.mutate({
      vendor_id: vendorId,
      payment_method: paymentMethod,
      pickup_slot_id: selectedSlotId || undefined,
      cutlery_needed: cutleryNeeded,
      reusable_container: reusableContainer,
      items: items.map((it) => ({
        menu_item_id: it.id,
        quantity: it.quantity,
      })),
      notes: notes.trim() || undefined,
    });
  };

  const handleCloseAll = () => {
    setConfirmedOrder(null);
    setAppliedPromo(null);
    setNotes("");
    onClose();
  };

  const handleViewTickets = () => {
    const targetId = confirmedOrder?.id;
    handleCloseAll();
    navigate(targetId ? `/student/orders?order=${targetId}` : "/student/orders");
  };

  if (!open) return null;

  // Mobile: a bottom sheet that slides up from the bottom edge. Tablet and up:
  // a panel docked to the right edge, because a sheet rising from the bottom of
  // a 1000px-wide screen reads as a phone layout stretched. The animation axis
  // has to follow, which is why this uses the breakpoint hook rather than CSS.
  const fromSide = !isMobile;

  return (
    <div className={`modal-backdrop ${fromSide ? "modal-backdrop-docked" : ""}`} onClick={handleCloseAll} role="presentation">
      <motion.div
        className="modal-card checkout-modal-card"
        onClick={(e) => e.stopPropagation()}
        initial={fromSide ? { x: "100%", opacity: 0 } : { y: "100%", opacity: 0 }}
        animate={{ x: 0, y: 0, opacity: 1 }}
        exit={fromSide ? { x: "100%", opacity: 0 } : { y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        role="dialog"
        aria-modal="true"
        aria-label={confirmedOrder ? "Order Confirmed" : "Your Food Tray"}
      >
        <div className="modal-handle" />

        <div className="modal-head">
          <h2 className="modal-title">
            {confirmedOrder ? "Order Confirmed" : "Your Food Tray"}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={handleCloseAll}
            aria-label="Close checkout"
          >
            ✕
          </button>
        </div>

        {confirmedOrder ? (
          <div className="checkout-success">
            <motion.div
              className="success-icon-wrap"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </motion.div>
            <h3 className="success-title">Token #{confirmedOrder.pickup_token}</h3>
            <p className="success-hint">
              Show this QR code at <strong>{vendorName || "the canteen counter"}</strong> for instant pickup.
            </p>

            <div className="success-token-card">
              <PickupToken token={confirmedOrder.pickup_token} orderId={confirmedOrder.id} />
            </div>

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleViewTickets}
              >
                Track Live Order Status →
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-block"
                onClick={handleCloseAll}
              >
                Done
              </button>
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            compact
            title="Your tray is empty"
            hint="Add a dish from the menu to get started."
          />
        ) : (
          <div>
            <div className="checkout-vendor-banner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span className="open-dot" /> Ordering from <strong>{vendorName}</strong>
              </div>
              <button 
                type="button" 
                className="btn btn-ghost btn-sm" 
                style={{ color: "var(--color-danger)", padding: "4px 8px", fontSize: "0.8rem" }}
                onClick={() => {
                  playPop();
                  clear();
                }}
              >
                Clear Tray
              </button>
            </div>

            {/* Line Items List with Animations */}
            <div className="checkout-items">
              <AnimatePresence>
                {items.map((it) => (
                  <motion.div
                    key={it.id}
                    className="checkout-item"
                    layout
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div>
                      <span className="checkout-item-name">{it.name}</span>
                      <div className="checkout-item-unit mono muted small">
                        {formatMoney(it.price)} each
                      </div>
                    </div>

                    <div className="checkout-item-right">
                      <div className="qty-stepper">
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => {
                            playPop();
                            decrement(it.id);
                          }}
                          aria-label="Decrease quantity"
                        >
                          −
                        </button>
                        <span className="qty-num mono">{it.quantity}</span>
                        <button
                          type="button"
                          className="qty-btn"
                          onClick={() => {
                            playPop();
                            increment(it.id);
                          }}
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

                      <span className="checkout-item-total mono">
                        {formatMoney(it.price * it.quantity)}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Promo Code Input */}
            <div className="checkout-promo-box">
              {appliedPromo ? (
                <div className="promo-applied-badge">
                  <span><strong>{appliedPromo}</strong> applied ({VALID_PROMOS[appliedPromo]?.desc})</span>
                  <button
                    type="button"
                    className="linklike small"
                    onClick={() => {
                      playPop();
                      setAppliedPromo(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <form onSubmit={handleApplyPromo} className="promo-form">
                  <input
                    type="text"
                    className="input input-sm mono uppercase"
                    placeholder="PROMO CODE (e.g. STUDENT50)"
                    value={promoInput}
                    onChange={(e) => setPromoInput(e.target.value)}
                  />
                  <button type="submit" className="btn btn-secondary btn-sm">
                    Apply
                  </button>
                </form>
              )}
              {promoError && <p className="field-hint form-error-inline">{promoError}</p>}
            </div>

            {/* Kitchen Instructions */}
            <label className="field">
              <span className="field-label">Kitchen instructions</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Less spicy, keep sauce separate"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </label>

            {/* Pickup Time Slot Picker (if vendor has active slots) */}
            {slots.length > 0 && (
              <div className="checkout-payment-box" style={{ marginBottom: "16px" }}>
                <span className="field-label">Scheduled Pickup Window (Optional)</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px", marginTop: "8px" }}>
                  <button
                    type="button"
                    className={`payment-option-card ${selectedSlotId === null ? "active" : ""}`}
                    onClick={() => {
                      playPop();
                      setSelectedSlotId(null);
                    }}
                    style={{ padding: "8px 10px", textAlign: "left" }}
                  >
                    <div className="payment-opt-title" style={{ fontSize: "0.85rem" }}>ASAP</div>
                    <div className="payment-opt-sub" style={{ fontSize: "0.75rem" }}>Standard queue</div>
                  </button>

                  {slots.map((s) => {
                    const isFull = s.current_order_count >= s.max_orders;
                    const isSelected = selectedSlotId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={isFull}
                        className={`payment-option-card ${isSelected ? "active" : ""} ${isFull ? "disabled" : ""}`}
                        onClick={() => {
                          if (!isFull) {
                            playPop();
                            setSelectedSlotId(s.id);
                          }
                        }}
                        style={{
                          padding: "8px 10px",
                          textAlign: "left",
                          opacity: isFull ? 0.45 : 1,
                          cursor: isFull ? "not-allowed" : "pointer"
                        }}
                      >
                        <div className="payment-opt-title mono" style={{ fontSize: "0.85rem" }}>
                          {s.start_time} - {s.end_time}
                        </div>
                        <div className="payment-opt-sub mono" style={{ fontSize: "0.75rem", color: isFull ? "var(--color-danger)" : undefined }}>
                          {isFull ? "Full" : `${s.max_orders - s.current_order_count} slots left`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="checkout-payment-box">
              <span className="field-label">Select Payment Method</span>
              <div className="payment-options-grid">
                <button
                  type="button"
                  className={`payment-option-card ${paymentMethod === "wallet" ? "active" : ""}`}
                  onClick={() => {
                    playPop();
                    setPaymentMethod("wallet");
                  }}
                >
                  <div className="payment-opt-title">Campus Prepaid Wallet</div>
                  <div className="payment-opt-sub mono">
                    Balance: ₹{walletBalance.toFixed(2)}
                  </div>
                </button>

                <button
                  type="button"
                  className={`payment-option-card ${paymentMethod === "pay_at_counter" ? "active" : ""}`}
                  onClick={() => {
                    playPop();
                    setPaymentMethod("pay_at_counter");
                  }}
                >
                  <div className="payment-opt-title">Pay at Counter</div>
                  <div className="payment-opt-sub">Cash / Campus Card</div>
                </button>

                {activeMealPlan && (
                  <button
                    type="button"
                    className={`payment-option-card ${paymentMethod === "meal_plan" ? "active" : ""}`}
                    onClick={() => {
                      playPop();
                      setPaymentMethod("meal_plan");
                    }}
                    style={{
                      border: paymentMethod === "meal_plan" ? "2px solid var(--color-forest)" : undefined,
                    }}
                  >
                    <div className="payment-opt-title">Redeem Meal Pass</div>
                    <div className="payment-opt-sub mono">
                      {activeMealPlan.meals_remaining} meals left ({activeMealPlan.meal_plan?.name})
                    </div>
                  </button>
                )}
              </div>

              {isInsufficientWallet && (
                <div className="insufficient-wallet-warn" role="alert">
                  <strong>Insufficient Wallet Balance:</strong> Available ₹{walletBalance.toFixed(2)}, required ₹{finalTotal.toFixed(2)}. Please switch to "Pay at Counter" or top up your wallet.
                </div>
              )}
            </div>

            {/* Eco & Sustainability Options */}
            <div className="checkout-payment-box" style={{ marginBottom: "16px" }}>
              <span className="field-label">Campus Sustainability & Eco-Choices</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: cutleryNeeded ? "rgba(255,255,255,0.03)" : "rgba(51,92,48,0.15)",
                    border: cutleryNeeded ? "1px solid var(--color-cream-hairline)" : "1px solid var(--color-forest)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                      {cutleryNeeded ? "Standard Cutlery & Napkins" : "No Cutlery (Zero Waste)"}
                    </span>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      {cutleryNeeded ? "Disposable fork/spoon provided" : "Save single-use plastic cutlery"}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!cutleryNeeded}
                    onChange={(e) => {
                      playPop();
                      setCutleryNeeded(!e.target.checked);
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--color-forest)" }}
                  />
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    background: reusableContainer ? "rgba(51,92,48,0.18)" : "rgba(255,255,255,0.03)",
                    border: reusableContainer ? "1px solid var(--color-forest)" : "1px solid var(--color-cream-hairline)",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Bring My Own Container / Dabba</span>
                      <span className="badge" style={{ fontSize: "0.65rem", padding: "2px 6px", background: "var(--color-sage-deep)", color: "var(--color-forest-deep)" }}>
                        ₹5 OFF
                      </span>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                      Hand your clean dabba at pickup counter
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={reusableContainer}
                    onChange={(e) => {
                      playPop();
                      setReusableContainer(e.target.checked);
                    }}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "var(--color-forest)" }}
                  />
                </label>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="checkout-summary">
              <div className="summary-row">
                <span>Tray Subtotal</span>
                <span className="mono">{formatMoney(subtotal)}</span>
              </div>
              {promoDiscountAmount > 0 && (
                <div className="summary-row summary-discount">
                  <span>Promo Discount ({appliedPromo})</span>
                  <span className="mono">- {formatMoney(promoDiscountAmount)}</span>
                </div>
              )}
              {ecoDiscountAmount > 0 && (
                <div className="summary-row summary-discount" style={{ color: "var(--color-forest)" }}>
                  <span>Reusable Container Eco-Discount</span>
                  <span className="mono">- {formatMoney(ecoDiscountAmount)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Canteen Packaging & Service</span>
                <span className="mono stat-lime">Free</span>
              </div>
              <div className="summary-total">
                <span>
                  Total (
                  {paymentMethod === "wallet"
                    ? "Wallet Deduction"
                    : paymentMethod === "meal_plan"
                    ? "1 Meal Pass Redeemed"
                    : "Pay at Counter"}
                  )
                </span>
                <span className="mono">
                  {paymentMethod === "meal_plan" ? "Pass Redemption" : formatMoney(finalTotal)}
                </span>
              </div>
            </div>

            {checkoutMutation.isError && (
              <div className="form-error" role="alert">
                {checkoutMutation.error?.message ?? "Checkout failed. Please try again."}
              </div>
            )}

            <motion.button
              type="button"
              className="btn btn-primary btn-block btn-lg"
              onClick={handleConfirm}
              disabled={checkoutMutation.isPending || isInsufficientWallet}
              whileTap={{ scale: 0.97 }}
            >
              {checkoutMutation.isPending ? (
                <Spinner size="sm" label="Confirming order..." />
              ) : isInsufficientWallet ? (
                "Insufficient Wallet Balance"
              ) : (
                `Confirm Order • ${formatMoney(finalTotal)}`
              )}
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
