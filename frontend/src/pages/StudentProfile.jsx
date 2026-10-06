import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth.js";
import { studentApi } from "../api/studentApi.js";
import { walletApi } from "../api/walletApi.js";
import { nutritionApi } from "../api/nutritionApi.js";
import { socialApi } from "../api/socialApi.js";
import { formatMoney } from "../lib/format.js";
import { playPop, playSuccess } from "../lib/sounds.js";

const ALLERGEN_OPTIONS = [
  { id: "dairy", label: "Dairy" },
  { id: "gluten", label: "Gluten" },
  { id: "peanuts", label: "Peanuts" },
  { id: "nuts", label: "Tree Nuts" },
  { id: "soy", label: "Soy" },
  { id: "eggs", label: "Eggs" },
  { id: "shellfish", label: "Shellfish" },
];

export default function StudentProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dietary, setDietary] = useState(() => localStorage.getItem("user_dietary_pref") || "all");

  const [hostelBlock, setHostelBlock] = useState(user?.hostel_block ?? "");
  const [department, setDepartment] = useState(user?.department ?? "");
  const [socialSaved, setSocialSaved] = useState(false);

  const { data: orders } = useQuery({
    queryKey: ["studentOrders"],
    queryFn: studentApi.listMyOrders,
  });

  const { data: wallet } = useQuery({
    queryKey: ["studentWallet"],
    queryFn: walletApi.getWallet,
  });

  const { data: allergenData } = useQuery({
    queryKey: ["studentAllergens"],
    queryFn: nutritionApi.getAllergenPreferences,
  });

  const { data: ecoStats } = useQuery({
    queryKey: ["studentSustainabilityStats"],
    queryFn: studentApi.getSustainabilityStats,
  });

  const [avoidedAllergens, setAvoidedAllergens] = useState([]);

  useEffect(() => {
    if (allergenData?.allergens) {
      setAvoidedAllergens(allergenData.allergens);
    }
  }, [allergenData]);

  const allergenMutation = useMutation({
    mutationFn: nutritionApi.updateAllergenPreferences,
    onSuccess: () => {
      playPop();
      queryClient.invalidateQueries({ queryKey: ["studentAllergens"] });
    },
  });

  const socialMutation = useMutation({
    mutationFn: socialApi.updateSocialProfile,
    onSuccess: () => {
      playSuccess();
      setSocialSaved(true);
      setTimeout(() => setSocialSaved(false), 2500);
    },
  });

  const handleSaveSocial = (e) => {
    e.preventDefault();
    socialMutation.mutate({
      hostel_block: hostelBlock.trim() || null,
      department: department.trim() || null,
    });
  };

  const totalOrders = orders?.length ?? 0;
  const completedOrders = orders?.filter((o) => o.status === "picked_up") ?? [];
  const totalSpent = completedOrders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
  const timeSavedMins = totalOrders * 15; // Estimated 15 mins queue time saved per order!
  const walletBalance = wallet?.balance ?? 0.0;

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  const handleSelectDietary = (id) => {
    playPop();
    setDietary(id);
    localStorage.setItem("user_dietary_pref", id);
  };

  const handleToggleAllergen = (id) => {
    const next = avoidedAllergens.includes(id)
      ? avoidedAllergens.filter((a) => a !== id)
      : [...avoidedAllergens, id];
    setAvoidedAllergens(next);
    allergenMutation.mutate(next);
  };

  return (
    <motion.div
      className="profile-page"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="page-head">
        <h1 className="page-title">My Profile</h1>
      </div>

      {/* User Card */}
      <div className="profile-user-card">
        <div className="profile-avatar">
          {(user?.name || "S")[0].toUpperCase()}
        </div>
        <div className="profile-user-info">
          <h2 className="profile-name">{user?.name ?? "Student"}</h2>
          <span className="profile-phone mono">{user?.phone_number ?? "Verified Account"}</span>
          <span className="profile-role-badge">Student • Foodie Pass</span>
        </div>
      </div>

      {/* Campus Wallet Card */}
      <div className="profile-wallet-banner" onClick={() => navigate("/student/wallet")}>
        <div className="profile-wallet-left">
          <span className="profile-wallet-tag">CAMPUS PREPAID WALLET</span>
          <div className="profile-wallet-bal mono">₹{walletBalance.toFixed(2)}</div>
          {wallet?.is_low_balance && <span className="low-bal-text">Low Balance Alert</span>}
        </div>
        <button type="button" className="btn btn-primary btn-sm">
          View Ledger →
        </button>
      </div>

      {/* Campus Meal Passes Card */}
      <div
        className="profile-wallet-banner profile-wallet-banner--passes"
        style={{ marginTop: "-4px" }}
        onClick={() => navigate("/student/meal-plans")}
      >
        <div className="profile-wallet-left">
          <span className="profile-wallet-tag">CAMPUS MEAL PASSES &amp; SUBSCRIPTIONS</span>
          <div className="profile-wallet-bal profile-wallet-bal--sm">
            Monthly Plans &amp; 10-Meal Passes
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm profile-wallet-cta">
          Manage Passes →
        </button>
      </div>

      {/* Class Schedule Card */}
      <div
        className="profile-wallet-banner profile-wallet-banner--schedule"
        style={{ marginTop: "-4px" }}
        onClick={() => navigate("/student/schedule")}
      >
        <div className="profile-wallet-left">
          <span className="profile-wallet-tag">TIMETABLE &amp; BREAK REMINDERS</span>
          <div className="profile-wallet-bal profile-wallet-bal--sm">
            Class Schedule &amp; Timing
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm profile-wallet-cta">
          Edit Timetable →
        </button>
      </div>

      {/* Campus Leaderboard Card */}
      <div
        className="profile-wallet-banner profile-wallet-banner--leaderboard"
        style={{ marginTop: "-4px" }}
        onClick={() => navigate("/student/leaderboard")}
      >
        <div className="profile-wallet-left">
          <span className="profile-wallet-tag">CAMPUS COMMUNITY &amp; RANKINGS</span>
          <div className="profile-wallet-bal profile-wallet-bal--sm">
            Campus Foodie Leaderboard
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm profile-wallet-cta">
          View Standings →
        </button>
      </div>

      {/* Quick Stats Ticker */}
      <div className="profile-stats-grid">
        <div className="profile-stat-card">
          <span className="stat-value mono">{totalOrders}</span>
          <span className="stat-label">Total Orders</span>
        </div>
        <div className="profile-stat-card">
          <span className="stat-value stat-lime mono">{formatMoney(totalSpent)}</span>
          <span className="stat-label">Total Spent</span>
        </div>
        <div className="profile-stat-card">
          <span className="stat-value stat-orange mono">{timeSavedMins}m</span>
          <span className="stat-label">Queue Time Saved</span>
        </div>
      </div>

      {/* Sustainability & Green Campus Impact */}
      <div className="profile-section" style={{ background: "linear-gradient(135deg, rgba(51,92,48,0.12) 0%, rgba(26,46,24,0.2) 100%)", border: "1px solid rgba(182,203,165,0.25)", borderRadius: "12px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <h3 className="section-title" style={{ margin: 0, color: "var(--color-forest)" }}>My Green Campus Impact</h3>
            <p className="small muted" style={{ margin: "2px 0 0" }}>Real metrics from BYO containers and zero-cutlery choices</p>
          </div>
          <span className="badge" style={{ background: "var(--color-forest)", color: "#fff", fontWeight: 700 }}>
            {ecoStats?.plastic_saved_grams ?? 0}g Waste Saved
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
          <div style={{ background: "var(--color-bg-elevated)", padding: "10px", borderRadius: "8px", textAlign: "center", border: "1px solid var(--color-cream-hairline)" }}>
            <div className="mono bold" style={{ fontSize: "1.1rem", color: "var(--color-forest)" }}>
              {ecoStats?.cutlery_saved_count ?? 0}
            </div>
            <div className="small muted" style={{ fontSize: "0.72rem" }}>Cutlery Saved</div>
          </div>
          <div style={{ background: "var(--color-bg-elevated)", padding: "10px", borderRadius: "8px", textAlign: "center", border: "1px solid var(--color-cream-hairline)" }}>
            <div className="mono bold" style={{ fontSize: "1.1rem", color: "var(--color-forest)" }}>
              {ecoStats?.containers_reused_count ?? 0}
            </div>
            <div className="small muted" style={{ fontSize: "0.72rem" }}>BYO Dabbas</div>
          </div>
          <div style={{ background: "var(--color-bg-elevated)", padding: "10px", borderRadius: "8px", textAlign: "center", border: "1px solid var(--color-cream-hairline)" }}>
            <div className="mono bold" style={{ fontSize: "1.1rem", color: "var(--color-forest)" }}>
              ₹{(ecoStats?.total_eco_saved_amount ?? 0).toFixed(0)}
            </div>
            <div className="small muted" style={{ fontSize: "0.72rem" }}>Eco-Discounts</div>
          </div>
        </div>
      </div>

      {/* Dietary Preference */}
      <div className="profile-section">
        <h3 className="section-title">Dietary Preference</h3>
        <p className="small muted" style={{ marginTop: "2px", marginBottom: "8px" }}>
          Your home menu will automatically show foods matching this preference.
        </p>
        <div className="diet-options-grid">
          {[
            { id: "all", label: "No Restrictions" },
            { id: "veg", label: "Pure Vegetarian" },
            { id: "vegan", label: "100% Vegan" },
            { id: "halal", label: "Halal / Organic" },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              className={`diet-option-btn ${dietary === d.id ? "diet-option-active" : ""}`}
              onClick={() => handleSelectDietary(d.id)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergen Avoidance Filters */}
      <div className="profile-section">
        <h3 className="section-title">Allergen Safety Filters</h3>
        <p className="small muted" style={{ marginTop: "2px", marginBottom: "8px" }}>
          Select ingredients you are allergic to. Dishes containing them will display warning tags.
        </p>
        <div className="diet-options-grid">
          {ALLERGEN_OPTIONS.map((a) => {
            const isAvoided = avoidedAllergens.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                className={`diet-option-btn ${isAvoided ? "diet-option-active" : ""}`}
                style={{
                  background: isAvoided ? "#ffebee" : undefined,
                  borderColor: isAvoided ? "var(--color-danger)" : undefined,
                  color: isAvoided ? "var(--color-danger)" : undefined,
                }}
                onClick={() => handleToggleAllergen(a.id)}
              >
                {a.label} {isAvoided ? "✕ Avoid" : ""}
              </button>
            );
          })}
        </div>
      </div>

      {/* Campus Identity */}
      <div className="profile-section">
        <h3 className="section-title">Campus Identity & Hostel</h3>
        <p className="small muted" style={{ marginTop: "2px", marginBottom: "12px" }}>
          Set your hostel block and department to show your hostel pride on the campus leaderboard.
        </p>

        <form onSubmit={handleSaveSocial} style={{ display: "grid", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Hostel / Residence</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Block A, Aryabhatta Hall"
                value={hostelBlock}
                onChange={(e) => setHostelBlock(e.target.value)}
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Department / Major</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. Computer Science"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
            {socialSaved ? (
              <span className="small stat-lime bold">✓ Campus identity saved!</span>
            ) : <span />}
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={socialMutation.isPending}
            >
              {socialMutation.isPending ? "Saving..." : "Save Identity"}
            </button>
          </div>
        </form>
      </div>

      {/* Actions */}
      <div className="profile-actions">
        <button
          type="button"
          className="btn btn-danger-ghost btn-block"
          onClick={handleLogout}
        >
          Sign Out of Account
        </button>
      </div>
    </motion.div>
  );
}
