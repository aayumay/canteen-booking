import { useState, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Mascot from "../common/Mascot.jsx";

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

export default function OrderTracker({ status, className = "" }) {
  const prefersReducedMotion = useReducedMotion();
  const prevIndexRef = useRef(0);
  const [tilt, setTilt] = useState(0);
  const [isBouncing, setIsBouncing] = useState(false);

  const isTerminalNegative = status === "rejected" || status === "cancelled";
  const stageIndex = ORDER_STAGES.findIndex((s) => s.key === status);
  const activeIndex = stageIndex >= 0 ? stageIndex : 0;

  // Track movement direction to tilt the mascot forward/backward while traveling
  useEffect(() => {
    if (prefersReducedMotion) return;

    if (prevIndexRef.current !== activeIndex) {
      const direction = activeIndex > prevIndexRef.current ? 12 : -12;
      setTilt(direction);

      const timer = setTimeout(() => {
        setTilt(0);
      }, 700);

      prevIndexRef.current = activeIndex;
      return () => clearTimeout(timer);
    }
  }, [activeIndex, prefersReducedMotion]);

  // Celebratory bounce when reaching 'ready' stage
  useEffect(() => {
    if (prefersReducedMotion) return;

    if (status === "ready") {
      setIsBouncing(true);
      const timer = setTimeout(() => setIsBouncing(false), 1800);
      return () => clearTimeout(timer);
    }
  }, [status, prefersReducedMotion]);

  if (isTerminalNegative) {
    return (
      <div className={`order-tracker-terminal-neg ${className}`}>
        <div className="terminal-neg-badge">
          <span className="terminal-neg-icon">✕</span>
          <span className="bold uppercase small">
            Order {status === "rejected" ? "Rejected" : "Cancelled"}
          </span>
        </div>
      </div>
    );
  }

  const trackPercent = (activeIndex / (ORDER_STAGES.length - 1)) * 100;

  return (
    <div
      className={`order-mascot-tracker ${className}`}
      role="region"
      aria-label={`Order tracking progress: ${ORDER_STAGES[activeIndex]?.label || status}`}
    >
      {/* Horizontal Track Container */}
      <div className="mascot-track-container">
        {/* Background Track Line */}
        <div className="mascot-track-line-bg" />

        {/* Lime Filled Progress Line */}
        <motion.div
          className="mascot-track-line-fill"
          initial={false}
          animate={{ width: `${trackPercent}%` }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 100, damping: 18 }
          }
        />

        {/* Traveling Mascot Rider */}
        <motion.div
          className="mascot-track-rider"
          initial={false}
          animate={{ left: `${trackPercent}%` }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 120, damping: 14 }
          }
        >
          <div className="mascot-rider-anchor">
            <Mascot
              size={36}
              variant={status === "ready" ? "detailed" : "default"}
              tilt={tilt}
              isBouncing={isBouncing}
            />
          </div>
        </motion.div>

        {/* 5 Stage Checkpoint Nodes */}
        <div className="mascot-track-nodes-row">
          {ORDER_STAGES.map((st, idx) => {
            const isCompleted = idx < activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div key={st.key} className="mascot-track-node-wrap">
                <div
                  className={`mascot-track-node ${
                    isCompleted ? "node-completed" : ""
                  } ${isCurrent ? "node-current" : ""}`}
                >
                  <span className="node-icon">{st.icon}</span>
                </div>
                <span
                  className={`mascot-node-label ${
                    isCompleted ? "label-completed" : ""
                  } ${isCurrent ? "label-current bold" : "label-future"}`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
