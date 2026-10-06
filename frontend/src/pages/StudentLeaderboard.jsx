import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { socialApi } from "../api/socialApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { Spinner } from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import { playPop, playSuccess } from "../lib/sounds.js";

export default function StudentLeaderboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [optIn, setOptIn] = useState(() => user?.leaderboard_opt_in ?? false);

  const lbQuery = useQuery({
    queryKey: ["campusLeaderboard"],
    queryFn: () => socialApi.getLeaderboard(20),
  });

  const optMutation = useMutation({
    mutationFn: (val) => socialApi.updateSocialProfile({ leaderboard_opt_in: val }),
    onSuccess: (_, val) => {
      playSuccess();
      setOptIn(val);
      queryClient.invalidateQueries({ queryKey: ["campusLeaderboard"] });
    },
  });

  const entries = lbQuery.data?.entries ?? [];
  const totalOptedIn = lbQuery.data?.opted_in_count ?? 0;

  const handleToggleOptIn = () => {
    const next = !optIn;
    setOptIn(next);
    optMutation.mutate(next);
  };

  return (
    <div className="healthy-discovery-page" style={{ paddingBottom: "90px" }}>
      {/* Top Bar */}
      <header className="healthy-top-nav">
        <Link to="/student/profile" className="nav-icon-btn" aria-label="Back">
          <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Campus Foodie Leaderboard</h2>
        <div style={{ width: 36 }} />
      </header>

      {/* Hero Head */}
      <div className="healthy-hero-head" style={{ marginBottom: "16px" }}>
        <h1 className="healthy-main-title" style={{ fontSize: "2rem" }}>
          Campus Leaderboard
        </h1>
        <p className="muted small" style={{ marginTop: "4px" }}>
          Top students across hostel blocks who pre-book fresh meals and save counter queue time.
        </p>

        {/* Opt-in Banner */}
        <div
          className="card"
          style={{
            marginTop: "14px",
            padding: "14px 16px",
            background: "var(--color-bg-elevated)",
            border: "1.5px solid var(--color-sage-deep)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
              Show my profile on leaderboard
            </div>
            <div className="small muted">
              Share your hostel block & order milestone with campus peers
            </div>
          </div>
          <button
            type="button"
            className={`switch ${optIn ? "switch-on" : ""}`}
            onClick={handleToggleOptIn}
            disabled={optMutation.isPending}
            aria-label="Toggle leaderboard participation"
          >
            <span className="switch-knob" />
          </button>
        </div>
      </div>

      {/* Leaderboard List */}
      <div className="healthy-section">
        <div className="healthy-section-head">
          <h2 className="healthy-section-title">Top Campus Foodies ({totalOptedIn} enrolled)</h2>
        </div>

        {lbQuery.isLoading ? (
          <div className="center-row"><Spinner size="md" label="Loading standings..." /></div>
        ) : entries.length === 0 ? (
          <EmptyState
            title="No students on leaderboard yet"
            hint="Toggle the switch above to become the first campus student on the leaderboard!"
          />
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {entries.map((e) => {
              const isTop3 = e.rank <= 3;
              const medal = `#${e.rank}`;
              const isMe = e.student_id === user?.id;

              return (
                <motion.div
                  key={e.student_id}
                  className="card"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "12px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    border: isMe ? "2px solid var(--color-forest)" : undefined,
                    background: isMe ? "#f0f4ee" : "var(--color-bg-elevated)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div
                      className="mono bold"
                      style={{
                        fontSize: isTop3 ? "1.2rem" : "1rem",
                        width: "36px",
                        textAlign: "center",
                        color: isTop3 ? "var(--color-forest)" : "var(--color-text-muted)",
                      }}
                    >
                      {medal}
                    </div>

                    <div>
                      <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                        {e.name} {isMe && <span className="badge badge-success small">You</span>}
                      </div>
                      <div className="small muted">
                        {e.hostel_block && <span>{e.hostel_block}</span>}
                        {e.hostel_block && e.department && " • "}
                        {e.department && <span>{e.department}</span>}
                        {!e.hostel_block && !e.department && <span>Campus Student</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div className="mono bold stat-lime" style={{ fontSize: "1.3rem" }}>
                      {e.total_orders}
                    </div>
                    <div className="small muted" style={{ fontSize: "0.75rem" }}>
                      Orders
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
