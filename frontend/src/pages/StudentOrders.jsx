import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { studentApi } from "../api/studentApi.js";
import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import OrderTicket from "../components/student/OrderTicket.jsx";
import { formatMoney } from "../lib/format.js";
import { playPop } from "../lib/sounds.js";

const TABS = [
  { key: "all", label: "All Tickets" },
  { key: "active", label: "Active & Cooking" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function StudentOrders() {
  const [searchParams] = useSearchParams();
  const highlightId = Number(searchParams.get("order")) || null;
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["studentOrders"],
    queryFn: studentApi.listMyOrders,
  });

  // Display ordering only (newest first).
  const allOrders = useMemo(
    () => (data ? [...data].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) : []),
    [data]
  );

  const activeCount = useMemo(
    () => allOrders.filter((o) => ["placed", "accepted", "preparing", "ready"].includes(o.status)).length,
    [allOrders]
  );

  const completedCount = useMemo(
    () => allOrders.filter((o) => o.status === "picked_up").length,
    [allOrders]
  );

  const totalSpent = useMemo(
    () => allOrders.filter((o) => o.status === "picked_up").reduce((sum, o) => sum + Number(o.total_amount || 0), 0),
    [allOrders]
  );

  const filteredOrders = useMemo(() => {
    if (activeTab === "active") {
      return allOrders.filter((o) => ["placed", "accepted", "preparing", "ready"].includes(o.status));
    }
    if (activeTab === "completed") {
      return allOrders.filter((o) => o.status === "picked_up");
    }
    if (activeTab === "cancelled") {
      return allOrders.filter((o) => ["cancelled", "rejected"].includes(o.status));
    }
    return allOrders;
  }, [allOrders, activeTab]);

  if (isLoading) {
    return (
      <div className="center-row" style={{ minHeight: "50vh" }}>
        <Spinner size="lg" label="Loading your tickets" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div className="healthy-discovery-page" style={{ paddingBottom: "90px" }}>
      {/* Top Navigation */}
      <header className="healthy-top-nav">
        <Link to="/student" className="nav-icon-btn" aria-label="Back to Menu" onClick={() => playPop()}>
          <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>My Orders</h2>
        <div style={{ width: 36 }} />
      </header>

      {/* Hero Header */}
      <motion.div
        className="healthy-hero-head"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="healthy-main-title" style={{ fontSize: "2.1rem" }}>
          Live Pickup Tickets
        </h1>
        <p className="muted small" style={{ marginTop: "4px" }}>
          Track real-time kitchen preparation, queue tokens, and scan your QR code at the stall counter.
        </p>

        {/* Marquee Strip */}
        <div className="marquee-strip" style={{ margin: "14px -18px 10px" }}>
          <span className="marquee-inner-text">
            Live Kitchen Tracking - Instant QR Verification - Zero Waiting Time - Fresh Campus Food - Live Kitchen Tracking - Instant QR Verification -
          </span>
        </div>

        {/* Stats Strip */}
        <div className="fact-strip" style={{ marginTop: "8px" }}>
          <div className="fact-item">
            <span className="fact-number">{activeCount}</span>
            <span className="fact-unit">live</span>
            <span className="fact-label">Active Now</span>
          </div>
          <div className="fact-item">
            <span className="fact-number">{completedCount}</span>
            <span className="fact-unit">done</span>
            <span className="fact-label">Picked Up</span>
          </div>
          <div className="fact-item">
            <span className="fact-number mono" style={{ fontSize: "1.15rem" }}>{formatMoney(totalSpent)}</span>
            <span className="fact-label">Total Spent</span>
          </div>
        </div>
      </motion.div>

      {/* Main Section: Ticket List with Filter Tabs */}
      <div className="healthy-section" style={{ marginTop: "12px" }}>
        <div className="healthy-section-head">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
            <h2 className="healthy-section-title">Your Tickets</h2>
            <span className="mono bold small" style={{ color: "var(--color-forest)" }}>
              {allOrders.length} {allOrders.length === 1 ? "Ticket" : "Tickets"}
            </span>
          </div>
        </div>

        {/* Filter Tabs */}
        {allOrders.length > 0 && (
          <div
            className="dietary-filter-bar"
            style={{
              marginBottom: "16px",
              paddingBottom: "4px",
            }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`dietary-filter-pill ${isActive ? "dietary-filter-active" : ""}`}
                  onClick={() => {
                    playPop();
                    setActiveTab(tab.key);
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {tab.label}
                  {tab.key === "active" && activeCount > 0 && (
                    <span
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 5px",
                        borderRadius: "10px",
                        background: isActive ? "var(--color-cream)" : "var(--color-forest)",
                        color: isActive ? "var(--color-forest)" : "var(--color-cream)",
                        fontWeight: 700,
                      }}
                    >
                      {activeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {allOrders.length === 0 ? (
          <EmptyState
            title="No orders yet"
            hint="Pick a canteen stall, build your tray, and your live ticket will appear here."
          />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            title={`No ${activeTab} tickets`}
            hint={`You do not have any tickets in the "${activeTab}" category.`}
          />
        ) : (
          <div className="ticket-grid">
            {filteredOrders.map((order) => (
              <OrderTicket key={order.id} order={order} highlight={order.id === highlightId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
