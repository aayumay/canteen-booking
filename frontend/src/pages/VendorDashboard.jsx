import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { vendorApi } from "../api/vendorApi.js";
import ErrorState from "../components/common/ErrorState.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import StaleStrip from "../components/common/StaleStrip.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import MenuManager from "../components/vendor/MenuManager.jsx";
import OrderQueueColumn from "../components/vendor/OrderQueueColumn.jsx";
import ShopToggle from "../components/vendor/ShopToggle.jsx";
import VendorReviewsList from "../components/vendor/VendorReviewsList.jsx";
import Mascot from "../components/common/Mascot.jsx";
import ImageUploader from "../components/common/ImageUploader.jsx";
import PickupSlotManager from "../components/vendor/PickupSlotManager.jsx";
import MealPlanManager from "../components/vendor/MealPlanManager.jsx";
import HourlyDemandChart from "../components/vendor/HourlyDemandChart.jsx";
import SettlementPanel from "../components/vendor/SettlementPanel.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { AnnouncementBanner } from "../components/common/AnnouncementBanner.jsx";
import DecorativeDoodles from "../components/common/DecorativeDoodles.jsx";
import { formatMoney } from "../lib/format.js";
import { playOrderAlert, playPop, playSuccess } from "../lib/sounds.js";

const BOARD_COLUMNS = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "rejected",
  "cancelled",
];

/**
 * Section rail. Labels are kept short enough to sit on one line inside a pill;
 * the long "Demand & Rush Hours" wording used to wrap inside a 90px circle.
 * `sub` doubles as the page subtitle so the current section is always named.
 */
const VENDOR_TABS = [
  {
    id: "orders",
    label: "Orders",
    sub: "Live queue. New orders appear here automatically.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  },
  {
    id: "menu",
    label: "Menu",
    sub: "Dishes, prices, availability and flash discounts.",
    icon: "M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4",
  },
  {
    id: "slots",
    label: "Pickup Slots",
    sub: "Capacity and rush-hour windows students can book.",
    icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
  {
    id: "meal_plans",
    label: "Meal Plans",
    sub: "Recurring meal plans offered at your stall.",
    icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  },
  {
    id: "analytics",
    label: "Demand",
    sub: "Which hours students actually order, so you can batch-cook.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
  {
    id: "settlements",
    label: "Settlements",
    sub: "What the institution owes you, and what has been paid out.",
    icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  {
    id: "reviews",
    label: "Reviews",
    sub: "What students said after eating here.",
    icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z",
  },
  {
    id: "profile",
    label: "Profile",
    sub: "Your stall name, manager and counter photo.",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
];

export default function VendorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tab = searchParams.get("tab") || "orders";

  const setTab = (newTab) => {
    navigate(`?tab=${newTab}`);
  };

  const [tokenSearch, setTokenSearch] = useState("");
  const prevOrderCountRef = useRef(0);

  const ordersQuery = useQuery({
    queryKey: ["vendorOrders"],
    queryFn: () => vendorApi.listIncomingOrders(),
    refetchInterval: 4000,
  });

  const orders = ordersQuery.data ?? [];

  // Sound chime when a new order arrives
  useEffect(() => {
    const placedCount = orders.filter((o) => o.status === "placed").length;
    if (placedCount > prevOrderCountRef.current && prevOrderCountRef.current !== 0) {
      playOrderAlert();
    }
    prevOrderCountRef.current = placedCount;
  }, [orders]);

  const byStatus = useMemo(() => {
    const map = Object.fromEntries(BOARD_COLUMNS.map((s) => [s, []]));
    for (const order of orders) {
      (map[order.status] ?? map.rejected).push(order);
    }
    for (const s of BOARD_COLUMNS) {
      map[s].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    return map;
  }, [orders]);

  // Daily statistics
  const activeOrdersCount = orders.filter((o) => ["placed", "accepted", "preparing", "ready"].includes(o.status)).length;
  const pickedOrders = orders.filter((o) => o.status === "picked_up");
  const todayRevenue = pickedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  // Token finder
  const matchedOrderByToken = useMemo(() => {
    if (!tokenSearch.trim()) return null;
    return orders.find(
      (o) =>
        o.pickup_token?.toLowerCase() === tokenSearch.trim().toLowerCase() ||
        String(o.id) === tokenSearch.trim()
    );
  }, [orders, tokenSearch]);

  /**
   * Handovers go through the dedicated verify endpoint so the ready-status
   * precondition and the pickup audit trail are enforced server-side, instead
   * of trusting whatever status the client happens to be looking at.
   */
  const [verifyError, setVerifyError] = useState(null);
  const verifyMutation = useMutation({
    mutationFn: (payload) => vendorApi.verifyPickup(payload),
    onSuccess: () => {
      playSuccess();
      setVerifyError(null);
      setTokenSearch("");
      ordersQuery.refetch();
    },
    onError: (err) => setVerifyError(err.message || "Could not verify this pickup."),
  });

  // Stall Profile form state
  const [profileName, setProfileName] = useState(user?.name || "");
  const [profileShopName, setProfileShopName] = useState(user?.shop_name || "");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(user?.stall_photo_url || "");
  const [profileSuccessMsg, setProfileSuccessMsg] = useState(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState(null);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfileShopName(user.shop_name || "");
      setProfilePhotoUrl(user.stall_photo_url || "");
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: vendorApi.updateProfile,
    onSuccess: () => {
      playSuccess();
      setProfileSuccessMsg("Stall profile updated successfully!");
      setProfileErrorMsg(null);
    },
    onError: (err) => {
      setProfileErrorMsg(err.message || "Failed to update profile.");
      setProfileSuccessMsg(null);
    },
  });

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Mascot size={26} variant="default" />
          <span className="brand-shopname">{user?.shop_name ?? "Your canteen"}</span>
        </div>
        <ShopToggle />
        <div className="topbar-user">
          <span className="topbar-name">{user?.name ?? "Vendor"}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {/* Pending Approval Banner */}
      {user?.is_approved === false && (
        <div className="vendor-pending-banner">
          <div className="vendor-pending-banner-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94520B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <div>
            <h4 className="vendor-pending-banner-title">Stall Pending Institution Admin Approval</h4>
            <p className="vendor-pending-banner-desc">
              Your stall is awaiting institution admin verification. You can configure your menu items and pickup slots now. Students will see your stall once approved.
            </p>
          </div>
        </div>
      )}

      {/* Decorative Hand-drawn Doodles */}
      <DecorativeDoodles />

      {/* Section navigation. A single rail rather than a row of large circular
          buttons: the previous version wrapped onto two rows and spent about
          240px of vertical space on navigation alone. */}
      <div className="vendor-intro">
        <h1 className="vendor-intro-title">{user?.shop_name ?? "Your canteen"}</h1>
        <p className="vendor-intro-sub">{VENDOR_TABS.find((t) => t.id === tab)?.sub}</p>
      </div>

      <nav className="vendor-rail" role="tablist" aria-label="Vendor sections">
        {VENDOR_TABS.map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`vendor-rail-item ${isActive ? "vendor-rail-item-active" : ""}`}
              onClick={() => {
                playPop();
                setTab(t.id);
              }}
            >
              <svg className="vendor-rail-icon" fill="none" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
              </svg>
              <span>{t.label}</span>
              {t.id === "orders" && activeOrdersCount > 0 ? (
                <span className="vendor-rail-count">{activeOrdersCount}</span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <main className="page page-wide" style={{ position: 'relative' }}>
        <AnnouncementBanner />
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {tab === "orders" ? (
              ordersQuery.isLoading ? (
                <div className="center-row">
                  <Spinner size="lg" label="Loading live orders" />
                </div>
              ) : ordersQuery.isError ? (
                <ErrorState error={ordersQuery.error} onRetry={() => ordersQuery.refetch()} />
              ) : (
                <>
                  {/* The board polls every 4s. A dropped poll leaves the last
                      board in place, which is right for a vendor mid-service —
                      but it has to be visible that it may be behind. */}
                  <StaleStrip
                    isStale={ordersQuery.isRefetchError}
                    onRetry={() => ordersQuery.refetch()}
                    isRefetching={ordersQuery.isFetching}
                    label="Live board may be out of date"
                  />
                  {/* Daily Stats Ticker */}
                  <div className="vendor-stats-banner">
                    <div className="vendor-stat-item">
                      <span className="vendor-stat-label">Active Orders</span>
                      <span className="vendor-stat-val stat-orange mono">{activeOrdersCount}</span>
                    </div>
                    <div className="vendor-stat-item">
                      <span className="vendor-stat-label">Completed Today</span>
                      <span className="vendor-stat-val stat-lime mono">{pickedOrders.length}</span>
                    </div>
                    <div className="vendor-stat-item">
                      <span className="vendor-stat-label">Today's Revenue</span>
                      <span className="vendor-stat-val stat-lime mono">{formatMoney(todayRevenue)}</span>
                    </div>
                  </div>
    
                  {/* Quick Pickup Token Scanner / Verifier */}
                  <div className="token-verifier-card">
                    <div className="token-verifier-head">
                      <span className="verifier-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                      </span>
                      <div>
                        <h4 className="verifier-title">Quick Token Pickup Verification</h4>
                        <p className="verifier-subtitle">Type token or scan QR code to verify student handover</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-block"
                      onClick={() => {
                        playPop();
                        navigate("/vendor/scan");
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "-3px", marginRight: "6px" }}><path d="M3 7V5a2 2 0 0 1 2-2h2" /><path d="M17 3h2a2 2 0 0 1 2 2v2" /><path d="M21 17v2a2 2 0 0 1-2 2h-2" /><path d="M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M3 12h18" /></svg>
                      Scan Student QR Code
                    </button>
                    {verifyError && <div className="form-error">{verifyError}</div>}
                    <div className="token-verifier-input-row">
                      <input
                        type="text"
                        className="input mono input-sm uppercase"
                        placeholder="ENTER 6-DIGIT TOKEN (e.g. 782914)"
                        value={tokenSearch}
                        onChange={(e) => setTokenSearch(e.target.value)}
                      />
                      {tokenSearch && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setTokenSearch("")}
                        >
                          Clear
                        </button>
                      )}
                    </div>
    
                    {matchedOrderByToken && (
                      <div className="token-verifier-result">
                        <div className="token-match-left">
                          <span className="token-stamp token-xs">
                            <span className="token-number mono">#{matchedOrderByToken.pickup_token}</span>
                          </span>
                          <span>Order #{matchedOrderByToken.id} • {formatMoney(matchedOrderByToken.total_amount)}</span>
                          <span className="badge badge-orange">{matchedOrderByToken.status}</span>
                        </div>
                        {matchedOrderByToken.status === "picked_up" ? (
                          <span className="badge badge-green">Already picked up</span>
                        ) : matchedOrderByToken.status !== "ready" ? (
                          <span className="badge badge-orange">
                            Not ready — mark it ready first
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={verifyMutation.isPending}
                            onClick={() => {
                              verifyMutation.mutate({
                                order_id: matchedOrderByToken.id,
                                pickup_token: matchedOrderByToken.pickup_token,
                              });
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "4px" }}><polyline points="20 6 9 17 4 12" /></svg>
                            {verifyMutation.isPending ? "Verifying..." : "Complete Handover"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
    
                  {/* Board Meta & Kanban View */}
                  <div className="board-meta">
                    <span className="live-pill">
                      <span className="live-dot" aria-hidden="true" /> Live Sync
                    </span>
                    <span className="dim small mono">Auto-refreshing (4s)</span>
                  </div>
    
                  {orders.length === 0 ? (
                    <EmptyState
                      title="No orders yet"
                      hint="They'll appear here the moment a student places an order."
                    />
                  ) : (
                    <div className="board" role="list">
                      {BOARD_COLUMNS.map((status) => (
                        <OrderQueueColumn key={status} status={status} orders={byStatus[status]} />
                      ))}
                    </div>
                  )}
                </>
              )
            ) : tab === "menu" ? (
              <MenuManager />
            ) : tab === "slots" ? (
              <PickupSlotManager />
            ) : tab === "meal_plans" ? (
              <MealPlanManager />
            ) : tab === "settlements" ? (
              <SettlementPanel />
            ) : tab === "profile" ? (
              <div className="card" style={{ maxWidth: "540px", margin: "0 auto" }}>
                <h2 className="section-title" style={{ marginBottom: "16px" }}>Stall & Partner Profile</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateProfileMutation.mutate({
                      name: profileName.trim(),
                      shop_name: profileShopName.trim(),
                      stall_photo_url: profilePhotoUrl.trim() || undefined,
                    });
                  }}
                  className="form-grid"
                >
                  {profileSuccessMsg && (
                    <div className="form-success">{profileSuccessMsg}</div>
                  )}
                  {profileErrorMsg && (
                    <div className="form-error">{profileErrorMsg}</div>
                  )}
    
                  <label className="field">
                    <span className="field-label">Manager / Owner Name</span>
                    <input
                      className="input"
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      required
                    />
                  </label>
    
                  <label className="field">
                    <span className="field-label">Canteen Shop / Stall Name</span>
                    <input
                      className="input"
                      type="text"
                      value={profileShopName}
                      onChange={(e) => setProfileShopName(e.target.value)}
                      required
                    />
                  </label>
    
                  <div style={{ margin: "8px 0 16px" }}>
                    <ImageUploader
                      label="Stall Banner / Counter Photo"
                      helperText="Visible to students on your vendor profile and search"
                      value={profilePhotoUrl}
                      onUploaded={(url) => setProfilePhotoUrl(url)}
                      onRemove={() => setProfilePhotoUrl("")}
                    />
                  </div>
    
                  <div className="center-row">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={updateProfileMutation.isPending}
                    >
                      {updateProfileMutation.isPending ? <Spinner size="sm" /> : "Save Profile Changes"}
                    </button>
                  </div>
                </form>
              </div>
            ) : tab === "analytics" ? (
              <HourlyDemandChart />
            ) : (
              <VendorReviewsList />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
