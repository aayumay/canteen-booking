import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import { Spinner } from "../common/Spinner.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { playPop, playSuccess } from "../../lib/sounds.js";
import { motion, AnimatePresence } from "framer-motion";

export default function PickupSlotManager() {
  const queryClient = useQueryClient();
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("12:15");
  const [maxOrders, setMaxOrders] = useState(15);
  const [formError, setFormError] = useState("");

  const slotsQuery = useQuery({
    queryKey: ["vendorSlotsList"],
    queryFn: vendorApi.listSlots,
  });

  const slots = slotsQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: vendorApi.createSlot,
    onSuccess: () => {
      playSuccess();
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["vendorSlotsList"] });
    },
    onError: (err) => {
      setFormError(err?.response?.data?.detail || "Failed to create slot.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: vendorApi.deleteSlot,
    onSuccess: () => {
      playPop();
      queryClient.invalidateQueries({ queryKey: ["vendorSlotsList"] });
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    setFormError("");
    if (!startTime || !endTime) {
      setFormError("Start and End time are required.");
      return;
    }
    if (startTime >= endTime) {
      setFormError("End time must be after start time.");
      return;
    }
    createMutation.mutate({
      start_time: startTime,
      end_time: endTime,
      max_orders: Number(maxOrders) || 10,
      is_active: true,
    });
  };

  const handleGenerateLunchRush = async () => {
    playPop();
    const rushSlots = [
      { start_time: "12:00", end_time: "12:15", max_orders: 15, is_active: true },
      { start_time: "12:15", end_time: "12:30", max_orders: 15, is_active: true },
      { start_time: "12:30", end_time: "12:45", max_orders: 15, is_active: true },
      { start_time: "12:45", end_time: "13:00", max_orders: 15, is_active: true },
      { start_time: "13:00", end_time: "13:15", max_orders: 15, is_active: true },
      { start_time: "13:15", end_time: "13:30", max_orders: 15, is_active: true },
    ];
    for (const s of rushSlots) {
      try {
        await vendorApi.createSlot(s);
      } catch {
        // ignore duplicate or error
      }
    }
    queryClient.invalidateQueries({ queryKey: ["vendorSlotsList"] });
  };

  return (
    <motion.div 
      className="slot-manager-container" 
      style={{ padding: "0 16px 40px", maxWidth: "600px", margin: "0 auto", position: 'relative' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div style={{ position: "relative", marginBottom: "24px" }}>
        <h3 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800, color: "var(--color-text)" }}>
          Pickup Window Slot Management
        </h3>
        {/* Hand-drawn Curved Arrow */}
        <svg style={{ position: "absolute", top: "0", right: "10px", width: "40px", color: "var(--color-text)" }} viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
          <path d="M90 20 Q50 -10 10 50" />
          <path d="M10 50 L30 40 M10 50 L20 70" />
        </svg>
        <p className="muted" style={{ margin: "8px 0 20px", fontSize: "0.95rem", paddingRight: "40px" }}>
          Configure 15-minute pickup intervals and maximum order limits to flatten counter queues.
        </p>

        <button
          type="button"
          onClick={handleGenerateLunchRush}
          disabled={createMutation.isPending}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            padding: "16px 20px",
            background: "rgba(182, 203, 165, 0.4)",
            border: "1.5px solid var(--color-forest)",
            borderRadius: "var(--radius-pill)",
            color: "var(--color-text)",
            fontWeight: 600,
            fontSize: "1rem",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer",
            transition: "transform 0.2s ease"
          }}
          onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.98)"}
          onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
            Auto-Generate Lunch Rush (12:00 - 13:30)
          </div>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <form onSubmit={handleCreate} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "32px", position: "relative" }}>
        
        <label className="field" style={{ margin: 0, gridColumn: "1" }}>
          <span className="field-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Start Time</span>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              style={{
                width: "100%", padding: "16px 16px 16px 44px", borderRadius: "var(--radius-pill)",
                background: "var(--color-bg)", border: "none", boxShadow: "var(--shadow-neo-in)",
                color: "var(--color-text)", fontWeight: 600, fontSize: "1.05rem"
              }}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
        </label>
        
        <label className="field" style={{ margin: 0, gridColumn: "2" }}>
          <span className="field-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>End Time</span>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <input
              type="time"
              style={{
                width: "100%", padding: "16px 16px 16px 44px", borderRadius: "var(--radius-pill)",
                background: "var(--color-bg)", border: "none", boxShadow: "var(--shadow-neo-in)",
                color: "var(--color-text)", fontWeight: 600, fontSize: "1.05rem"
              }}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </label>
        
        <label className="field" style={{ margin: 0, gridColumn: "1" }}>
          <span className="field-label" style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Max Order Cap</span>
          <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--color-text-muted)" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <input
              type="number"
              min="1"
              max="100"
              style={{
                width: "100%", padding: "16px 16px 16px 44px", borderRadius: "var(--radius-pill)",
                background: "var(--color-bg)", border: "none", boxShadow: "var(--shadow-neo-in)",
                color: "var(--color-text)", fontWeight: 600, fontSize: "1.05rem"
              }}
              value={maxOrders}
              onChange={(e) => setMaxOrders(e.target.value)}
              required
            />
          </div>
        </label>
        
        <div style={{ gridColumn: "2", display: "flex", alignItems: "flex-end", position: "relative" }}>
          <button
            type="submit"
            disabled={createMutation.isPending}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              padding: "16px 20px",
              background: "var(--color-forest)",
              border: "none",
              borderRadius: "var(--radius-pill)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "1.05rem",
              boxShadow: "var(--shadow-lime)",
              cursor: "pointer",
              transition: "transform 0.2s ease"
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
            onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            <span>{createMutation.isPending ? "Adding..." : "+ Add Slot"}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          
          {/* Action Lines // Doodle */}
          <svg style={{ position: "absolute", top: "-10px", right: "-20px", width: "30px", color: "var(--color-text)" }} viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <path d="M 5 15 L 15 0 M 15 25 L 25 10" />
          </svg>
        </div>
        
        {formError && <p className="form-error-inline small" style={{ gridColumn: "1 / -1", color: "var(--color-danger)", marginTop: "8px" }}>{formError}</p>}
      </form>

      {slotsQuery.isLoading ? (
        <div className="center-row" style={{ padding: "30px 0" }}>
          <Spinner size="md" label="Loading slots..." />
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          title="No pickup slots defined"
          hint="Add pickup slots above to enable scheduled pickup windows."
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <AnimatePresence>
            {slots.map((s) => {
              const isFull = s.current_order_count >= s.max_orders;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: -20 }}
                  layout
                  style={{
                    padding: "20px 24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(255, 255, 255, 0.4)",
                    borderRadius: "var(--radius-lg)",
                    boxShadow: "var(--shadow-sm)",
                    border: "1px solid rgba(255,255,255,0.6)"
                  }}
                >
                  <div>
                    <div className="mono" style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--color-text)", letterSpacing: "0.5px" }}>
                      {s.start_time} - {s.end_time}
                    </div>
                    <div className="mono" style={{ marginTop: "6px", fontSize: "0.95rem", color: "var(--color-text-muted)" }}>
                      Bookings: <strong style={{ color: "var(--color-text)" }}>{s.current_order_count}</strong> / {s.max_orders} max
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(s.id)}
                    disabled={deleteMutation.isPending}
                    title="Remove this slot"
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      background: "var(--color-danger-soft)",
                      color: "var(--color-danger)",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 2px 8px rgba(217, 83, 79, 0.2)",
                      transition: "transform 0.15s ease"
                    }}
                    onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.85)"}
                    onMouseUp={(e) => e.currentTarget.style.transform = "scale(1)"}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
