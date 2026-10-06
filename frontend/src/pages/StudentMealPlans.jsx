import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { mealPlanApi } from "../api/mealPlanApi.js";
import { walletApi } from "../api/walletApi.js";
import { Spinner } from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import { formatMoney, formatRelativeTime } from "../lib/format.js";
import { playPop, playSuccess } from "../lib/sounds.js";
import { prefersReducedMotion } from "../components/landing/motion.jsx";

export default function StudentMealPlans() {
  const queryClient = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [purchaseError, setPurchaseError] = useState("");

  const plansQuery = useQuery({
    queryKey: ["availableMealPlans"],
    queryFn: mealPlanApi.listAvailablePlans,
  });

  const subsQuery = useQuery({
    queryKey: ["myMealPlans"],
    queryFn: mealPlanApi.getMySubscriptions,
  });

  const walletQuery = useQuery({
    queryKey: ["studentWallet"],
    queryFn: walletApi.getWallet,
  });

  const plans = plansQuery.data ?? [];
  const subs = subsQuery.data ?? [];
  const walletBalance = walletQuery.data?.balance ?? 0.0;

  const subscribeMutation = useMutation({
    mutationFn: (planId) => mealPlanApi.subscribeToPlan(planId),
    onSuccess: () => {
      playSuccess();
      // Canvas burst bypasses the reduced-motion stylesheet — guard it directly.
      if (!prefersReducedMotion()) {
        try {
          confetti({
            particleCount: 70,
            spread: 60,
            origin: { y: 0.6 },
            colors: ["#335C30", "#C9A227", "#B6CBA5"],
          });
        } catch {
          // ignore
        }
      }
      setSelectedPlan(null);
      setPurchaseError("");
      queryClient.invalidateQueries({ queryKey: ["myMealPlans"] });
      queryClient.invalidateQueries({ queryKey: ["studentWallet"] });
    },
    onError: (err) => {
      setPurchaseError(err?.response?.data?.detail || "Failed to purchase subscription.");
    },
  });

  const handleOpenSubscribe = (plan) => {
    playPop();
    setPurchaseError("");
    setSelectedPlan(plan);
  };

  const handleConfirmSubscribe = () => {
    if (!selectedPlan) return;
    subscribeMutation.mutate(selectedPlan.id);
  };

  return (
    <div className="healthy-discovery-page" style={{ paddingBottom: "90px" }}>
      {/* Top Navigation */}
      <header className="healthy-top-nav">
        <Link to="/student/profile" className="nav-icon-btn" aria-label="Back">
          <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Meal Plans & Passes</h2>
        <div style={{ width: 36 }} />
      </header>

      {/* Header Banner */}
      <div className="healthy-hero-head" style={{ marginBottom: "16px" }}>
        <h1 className="healthy-main-title" style={{ fontSize: "2rem" }}>
          Campus Meal Passes
        </h1>
        <p className="muted small" style={{ marginTop: "4px" }}>
          Pre-pay monthly bundles with your campus wallet and redeem instant counter meals without per-order transactions.
        </p>
      </div>

      {/* Section 1: Active Passes */}
      <div className="healthy-section">
        <div className="healthy-section-head">
          <h2 className="healthy-section-title">My Active Meal Passes</h2>
        </div>

        {subsQuery.isLoading ? (
          <div className="center-row"><Spinner size="md" label="Loading passes..." /></div>
        ) : subs.length === 0 ? (
          <EmptyState
            title="No active meal passes"
            hint="Purchase a 10-meal pass or monthly bundle below to enjoy discounted canteen meals."
          />
        ) : (
          <div style={{ display: "grid", gap: "12px" }}>
            {subs.map((s) => {
              const expiresDate = new Date(s.expires_at).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const isExpired = new Date(s.expires_at) < new Date() || s.meals_remaining === 0;

              return (
                <div
                  key={s.id}
                  className="card"
                  style={{
                    padding: "16px",
                    background: isExpired ? "#f5f5f5" : "var(--color-bg-elevated)",
                    border: isExpired ? "1px solid #e0e0e0" : "2px solid var(--color-sage-deep)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span className="badge badge-success small" style={{ marginBottom: "6px" }}>
                        {s.meal_plan?.vendor_shop_name || "Campus Vendor"}
                      </span>
                      <h3 style={{ margin: "2px 0 4px", fontSize: "1.2rem", fontWeight: 700 }}>
                        {s.meal_plan?.name || "Meal Pass"}
                      </h3>
                      <div className="small muted">
                        Expires: <span className="mono">{expiresDate}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono bold" style={{ fontSize: "1.8rem", color: isExpired ? "var(--color-text-muted)" : "var(--color-forest)" }}>
                        {s.meals_remaining}
                      </div>
                      <div className="small muted uppercase" style={{ letterSpacing: "0.5px" }}>
                        Meals Left
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 2: Available Plans */}
      <div className="healthy-section" style={{ marginTop: "24px" }}>
        <div className="healthy-section-head">
          <h2 className="healthy-section-title">Available Canteen Passes</h2>
        </div>

        {plansQuery.isLoading ? (
          <div className="center-row"><Spinner size="md" label="Loading available plans..." /></div>
        ) : plans.length === 0 ? (
          <EmptyState
            title="No meal plans currently published"
            hint="Canteen vendors have not published any pass bundles right now. Check back soon!"
          />
        ) : (
          <div style={{ display: "grid", gap: "14px" }}>
            {plans.map((p) => {
              const pricePerMeal = (p.price / p.total_meals).toFixed(1);
              return (
                <div
                  key={p.id}
                  className="card"
                  style={{
                    padding: "16px",
                    borderRadius: "16px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span className="badge mono small" style={{ background: "#e8f5e9", color: "#2e7d32", marginBottom: "6px" }}>
                        {p.vendor_shop_name || "Canteen Vendor"}
                      </span>
                      <h3 style={{ margin: "2px 0 4px", fontSize: "1.15rem", fontWeight: 700 }}>
                        {p.name}
                      </h3>
                      {p.description && <p className="small muted" style={{ margin: "2px 0 8px" }}>{p.description}</p>}
                      <div className="small mono muted" style={{ display: "flex", gap: "12px" }}>
                        <span>{p.total_meals} Meals</span>
                        <span>{p.validity_days} Days validity</span>
                        <span>₹{pricePerMeal}/meal</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono bold" style={{ fontSize: "1.4rem", color: "var(--color-forest)" }}>
                        {formatMoney(p.price)}
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: "10px" }}
                        onClick={() => handleOpenSubscribe(p)}
                      >
                        Subscribe
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Subscription Confirmation Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="modal-backdrop" onClick={() => setSelectedPlan(null)}>
            <motion.div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              style={{ maxWidth: "440px" }}
            >
              <div className="modal-handle" />
              <div className="modal-head">
                <h3 className="modal-title">Confirm Meal Pass Purchase</h3>
                <button type="button" className="modal-close" onClick={() => setSelectedPlan(null)}>✕</button>
              </div>

              <div style={{ padding: "12px 0" }}>
                <p>
                  You are subscribing to <strong>{selectedPlan.name}</strong> from <strong>{selectedPlan.vendor_shop_name || "Campus Vendor"}</strong>.
                </p>

                <div className="fact-strip" style={{ margin: "16px 0" }}>
                  <div className="fact-item"><span className="fact-number">{selectedPlan.total_meals}</span><span className="fact-label">Meals</span></div>
                  <div className="fact-item"><span className="fact-number">{selectedPlan.validity_days}</span><span className="fact-unit">d</span><span className="fact-label">Validity</span></div>
                  <div className="fact-item"><span className="fact-number">₹{(selectedPlan.price / selectedPlan.total_meals).toFixed(0)}</span><span className="fact-label">Per Meal</span></div>
                </div>

                <div className="checkout-summary" style={{ margin: "16px 0" }}>
                  <div className="summary-row">
                    <span>Plan Price</span>
                    <span className="mono bold">{formatMoney(selectedPlan.price)}</span>
                  </div>
                  <div className="summary-row">
                    <span>Your Prepaid Wallet</span>
                    <span className="mono">{formatMoney(walletBalance)}</span>
                  </div>
                  <div className="summary-total">
                    <span>Balance After</span>
                    <span className="mono" style={{ color: walletBalance < selectedPlan.price ? "var(--color-danger)" : undefined }}>
                      {formatMoney(walletBalance - selectedPlan.price)}
                    </span>
                  </div>
                </div>

                {walletBalance < selectedPlan.price && (
                  <div className="insufficient-wallet-warn" style={{ marginBottom: "12px" }}>
                    Insufficient wallet balance. Please top up your wallet in Accounts / Admin office before subscribing.
                  </div>
                )}

                {purchaseError && <p className="form-error-inline" style={{ color: "var(--color-danger)" }}>{purchaseError}</p>}

                <div className="btn-row" style={{ marginTop: "16px" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    disabled={walletBalance < selectedPlan.price || subscribeMutation.isPending}
                    onClick={handleConfirmSubscribe}
                  >
                    {subscribeMutation.isPending ? "Processing..." : `Pay ${formatMoney(selectedPlan.price)} via Wallet`}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={() => setSelectedPlan(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
