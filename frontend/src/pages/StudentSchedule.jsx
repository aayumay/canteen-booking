import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { scheduleApi } from "../api/scheduleApi.js";
import { Spinner } from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import { DoodleClock } from "../components/common/doodles.jsx";
import { playPop, playSuccess } from "../lib/sounds.js";

const DAYS = [
  { id: 0, label: "Mon", full: "Monday" },
  { id: 1, label: "Tue", full: "Tuesday" },
  { id: 2, label: "Wed", full: "Wednesday" },
  { id: 3, label: "Thu", full: "Thursday" },
  { id: 4, label: "Fri", full: "Friday" },
  { id: 5, label: "Sat", full: "Saturday" },
  { id: 6, label: "Sun", full: "Sunday" },
];

export default function StudentSchedule() {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState(() => {
    const d = new Date().getDay();
    return d === 0 ? 6 : d - 1; // map 0=Sun -> 6, 1=Mon -> 0
  });

  const [className, setClassName] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("11:30");
  const [location, setLocation] = useState("");
  const [formError, setFormError] = useState("");

  const scheduleQuery = useQuery({
    queryKey: ["studentSchedule"],
    queryFn: scheduleApi.listSchedule,
  });

  const breakQuery = useQuery({
    queryKey: ["upcomingBreak"],
    queryFn: scheduleApi.getUpcomingBreak,
  });

  const entries = scheduleQuery.data ?? [];
  const breakInfo = breakQuery.data;

  const addMutation = useMutation({
    mutationFn: scheduleApi.addScheduleEntry,
    onSuccess: () => {
      playSuccess();
      setClassName("");
      setLocation("");
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["studentSchedule"] });
      queryClient.invalidateQueries({ queryKey: ["upcomingBreak"] });
    },
    onError: (err) => {
      setFormError(err?.response?.data?.detail || "Failed to add class.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: scheduleApi.deleteScheduleEntry,
    onSuccess: () => {
      playPop();
      queryClient.invalidateQueries({ queryKey: ["studentSchedule"] });
      queryClient.invalidateQueries({ queryKey: ["upcomingBreak"] });
    },
  });

  const handleAddClass = (e) => {
    e.preventDefault();
    setFormError("");
    if (!className.trim() || !startTime || !endTime) {
      setFormError("Class name and times are required.");
      return;
    }
    if (startTime >= endTime) {
      setFormError("End time must be after start time.");
      return;
    }
    addMutation.mutate({
      day_of_week: selectedDay,
      class_name: className.trim(),
      start_time: startTime,
      end_time: endTime,
      location: location.trim() || undefined,
    });
  };

  const dayEntries = entries.filter((e) => e.day_of_week === selectedDay);

  return (
    <div className="healthy-discovery-page" style={{ paddingBottom: "90px" }}>
      {/* Top Bar */}
      <header className="healthy-top-nav">
        <Link to="/student/profile" className="nav-icon-btn" aria-label="Back">
          <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
        <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>Class Schedule</h2>
        <div style={{ width: 36 }} />
      </header>

      {/* Hero Banner */}
      <div className="healthy-hero-head" style={{ marginBottom: "16px" }}>
        <h1 className="healthy-main-title" style={{ fontSize: "2rem" }}>
          Lecture Timetable
        </h1>
        <p className="muted small" style={{ marginTop: "4px" }}>
          Input your daily classes to receive timely canteen pickup suggestions right before lecture breaks.
        </p>

        {/* Live timing intelligence pill */}
        {breakInfo && (
          <div
            className="card"
            style={{
              marginTop: "14px",
              padding: "12px 16px",
              background: "linear-gradient(135deg, #1E3B1B 0%, #335C30 100%)",
              color: "#fff",
              borderRadius: "14px",
            }}
          >
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "4px" }}>
              <DoodleClock size={20} style={{ color: "var(--color-sage-deep)" }} />
              <strong style={{ fontSize: "0.95rem", color: "var(--color-sage-deep)" }}>TIMING INTELLIGENCE</strong>
            </div>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "#F5F0E8" }}>
              {breakInfo.suggestion_message}
            </p>
          </div>
        )}
      </div>

      {/* Day Selector Tabs */}
      <div className="dietary-filter-bar" style={{ margin: "16px 0 20px" }}>
        {DAYS.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`dietary-filter-pill ${selectedDay === d.id ? "dietary-filter-active" : ""}`}
            onClick={() => {
              playPop();
              setSelectedDay(d.id);
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Add Class Form */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "1.15rem", fontWeight: 700 }}>
          + Add Lecture on {DAYS.find((d) => d.id === selectedDay)?.full}
        </h3>

        <form onSubmit={handleAddClass} style={{ display: "grid", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "10px" }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Course / Lecture Name</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Operating Systems"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                required
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Start Time</span>
              <input
                type="time"
                className="input input-sm mono"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">End Time</span>
              <input
                type="time"
                className="input input-sm mono"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "flex-end" }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Room / Lab Location (Optional)</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. CS Block Room 301"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={addMutation.isPending}
              style={{ height: "36px" }}
            >
              {addMutation.isPending ? "Adding..." : "+ Save Class"}
            </button>
          </div>

          {formError && (
            <p className="form-error-inline small" style={{ color: "var(--color-danger)" }}>
              {formError}
            </p>
          )}
        </form>
      </div>

      {/* Lectures for Selected Day */}
      <div className="healthy-section">
        <div className="healthy-section-head">
          <h2 className="healthy-section-title">
            {DAYS.find((d) => d.id === selectedDay)?.full} Schedule ({dayEntries.length})
          </h2>
        </div>

        {scheduleQuery.isLoading ? (
          <div className="center-row"><Spinner size="md" label="Loading timetable..." /></div>
        ) : dayEntries.length === 0 ? (
          <EmptyState
            title={`No classes on ${DAYS.find((d) => d.id === selectedDay)?.full}`}
            hint="Add your lectures using the form above to enable break reminders."
          />
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {dayEntries.map((e) => (
              <div
                key={e.id}
                className="card"
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderLeft: "4px solid var(--color-forest)",
                }}
              >
                <div>
                  <div className="mono bold" style={{ fontSize: "1.05rem" }}>
                    {e.start_time} – {e.end_time}
                  </div>
                  <h4 style={{ margin: "2px 0 0", fontSize: "1.05rem", fontWeight: 600 }}>
                    {e.class_name}
                  </h4>
                  {e.location && <div className="small muted">Room / Hall: {e.location}</div>}
                </div>

                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => deleteMutation.mutate(e.id)}
                  disabled={deleteMutation.isPending}
                  style={{ color: "var(--color-danger)" }}
                  title="Delete class"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
