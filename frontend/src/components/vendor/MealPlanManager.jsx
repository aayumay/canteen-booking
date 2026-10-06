import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mealPlanApi } from "../../api/mealPlanApi.js";
import { Spinner } from "../common/Spinner.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { formatMoney } from "../../lib/format.js";
import { playPop, playSuccess } from "../../lib/sounds.js";

export default function MealPlanManager() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [totalMeals, setTotalMeals] = useState("10");
  const [validityDays, setValidityDays] = useState("30");
  const [formError, setFormError] = useState("");

  const plansQuery = useQuery({
    queryKey: ["vendorMealPlans"],
    queryFn: mealPlanApi.vendorListPlans,
  });

  const plans = plansQuery.data ?? [];

  const createMutation = useMutation({
    mutationFn: mealPlanApi.vendorCreatePlan,
    onSuccess: () => {
      playSuccess();
      setName("");
      setDescription("");
      setPrice("");
      setFormError("");
      queryClient.invalidateQueries({ queryKey: ["vendorMealPlans"] });
    },
    onError: (err) => {
      setFormError(err?.response?.data?.detail || "Failed to create meal plan.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ planId, isActive }) =>
      mealPlanApi.vendorUpdatePlan(planId, { is_active: !isActive }),
    onSuccess: () => {
      playPop();
      queryClient.invalidateQueries({ queryKey: ["vendorMealPlans"] });
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    setFormError("");
    if (!name.trim() || !price) {
      setFormError("Plan name and price are required.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      price: Number(price),
      total_meals: Number(totalMeals) || 10,
      validity_days: Number(validityDays) || 30,
    });
  };

  return (
    <div className="meal-plan-manager-container" style={{ padding: "16px 0" }}>
      {/* Create Plan Form Card */}
      <div className="card" style={{ marginBottom: "20px" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: "1.2rem", fontWeight: 700 }}>
          Create New Meal Pass / Subscription
        </h3>
        <p className="muted small" style={{ margin: "0 0 16px" }}>
          Sell bulk prepaid bundles (e.g. 10-Thali Lunch Pack) directly to students via campus wallet.
        </p>

        <form onSubmit={handleCreate} style={{ display: "grid", gap: "12px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "10px" }}>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Plan Name</span>
              <input
                type="text"
                className="input input-sm"
                placeholder="e.g. 10-Meal Student Thali Pack"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Total Price (₹)</span>
              <input
                type="number"
                min="1"
                step="1"
                className="input input-sm mono"
                placeholder="500"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Total Meals</span>
              <input
                type="number"
                min="1"
                max="100"
                className="input input-sm mono"
                value={totalMeals}
                onChange={(e) => setTotalMeals(e.target.value)}
                required
              />
            </label>
            <label className="field" style={{ margin: 0 }}>
              <span className="field-label small">Validity (Days)</span>
              <input
                type="number"
                min="1"
                max="365"
                className="input input-sm mono"
                value={validityDays}
                onChange={(e) => setValidityDays(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="field" style={{ margin: 0 }}>
            <span className="field-label small">Plan Description (Optional)</span>
            <input
              type="text"
              className="input input-sm"
              placeholder="e.g. Valid for any standard lunch combo during lunch hours (12:00 - 15:00)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {formError && (
            <p className="form-error-inline small" style={{ color: "var(--color-danger)" }}>
              {formError}
            </p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating..." : "+ Publish Meal Plan"}
            </button>
          </div>
        </form>
      </div>

      {/* Published Plans */}
      <h3 style={{ margin: "24px 0 12px", fontSize: "1.1rem", fontWeight: 700 }}>
        Your Active Meal Plans ({plans.length})
      </h3>

      {plansQuery.isLoading ? (
        <div className="center-row" style={{ padding: "30px 0" }}>
          <Spinner size="md" label="Loading meal plans..." />
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          title="No meal plans published yet"
          hint="Create a meal plan above to allow students to pre-purchase meal bundles."
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
          {plans.map((p) => {
            const pricePerMeal = (p.price / p.total_meals).toFixed(1);
            return (
              <div
                key={p.id}
                className="card"
                style={{
                  padding: "16px",
                  borderLeft: p.is_active ? "4px solid var(--color-forest)" : "4px solid var(--color-danger)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <h4 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 700 }}>{p.name}</h4>
                  <span className="mono bold" style={{ fontSize: "1.15rem", color: "var(--color-forest)" }}>
                    {formatMoney(p.price)}
                  </span>
                </div>
                {p.description && <p className="small muted" style={{ margin: "2px 0 8px" }}>{p.description}</p>}
                <div className="small mono muted" style={{ margin: "6px 0 12px" }}>
                  {p.total_meals} Meals • {p.validity_days} Days • ₹{pricePerMeal}/Meal
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className={`badge ${p.is_active ? "badge-success" : "badge-orange"} small`}>
                    {p.is_active ? "Active" : "Paused"}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => toggleMutation.mutate({ planId: p.id, isActive: p.is_active })}
                    disabled={toggleMutation.isPending}
                  >
                    {p.is_active ? "Pause Plan" : "Resume Plan"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
