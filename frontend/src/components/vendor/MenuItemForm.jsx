import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import Modal from "../common/Modal.jsx";
import { Spinner } from "../common/Spinner.jsx";
import ImageUploader from "../common/ImageUploader.jsx";

const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  category: "",
  image_url: "",
  is_available: true,
  ingredients: "",
  serving_size: "",
  calories: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  fiber_g: "",
  allergens: "",
  is_vegan: false,
  is_flash_discount: false,
  flash_discount_percent: "20",
};

export default function MenuItemForm({ item, onClose }) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(item?.id);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(() =>
    item?.id
      ? {
          ...EMPTY_FORM,
          ...Object.fromEntries(
            Object.entries(EMPTY_FORM).map(([key, blank]) => [
              key,
              // Numbers come back from the API as JSON numbers, so
              // String(value) keeps the inputs controlled without printing
              // "null" for fields the vendor never filled in.
              blank === "" && item[key] != null ? String(item[key]) : (item[key] ?? blank),
            ])
          ),
        }
      : EMPTY_FORM
  );

  // Open the section by default when editing an item that already has
  // nutrition, so saving would not silently hide existing data.
  const [showNutrition, setShowNutrition] = useState(() =>
    Boolean(
      item?.id &&
        (item.ingredients ||
          item.serving_size ||
          item.calories != null ||
          item.protein_g != null ||
          item.carbs_g != null ||
          item.fat_g != null ||
          item.fiber_g != null)
    )
  );

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const mutation = useMutation({
    mutationFn: (payload) =>
      isEdit ? vendorApi.updateMenuItem(item.id, payload) : vendorApi.addMenuItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendorMenu"] });
      onClose();
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    const name = form.name.trim();
    const price = Number(form.price);
    if (!name) {
      setError(new Error("Name is required."));
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setError(new Error("Price must be a number greater than zero."));
      return;
    }

    // Nutrition is optional throughout: a blank field is sent as null, which
    // the API stores as "no data". Only a value the vendor actually typed gets
    // checked, and only for being a real non-negative number - the section must
    // never stand between someone and listing a snack.
    const optionalNumber = (key, label) => {
      const raw = form[key].trim();
      if (raw === "") return null;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`${label} must be a number of zero or more.`);
      }
      return n;
    };

    let nutrition;
    try {
      nutrition = {
        ingredients: form.ingredients.trim() || null,
        serving_size: form.serving_size.trim() || null,
        calories: optionalNumber("calories", "Calories"),
        protein_g: optionalNumber("protein_g", "Protein"),
        carbs_g: optionalNumber("carbs_g", "Carbs"),
        fat_g: optionalNumber("fat_g", "Fat"),
        fiber_g: optionalNumber("fiber_g", "Fiber"),
      };
    } catch (err) {
      setError(err);
      return;
    }

    mutation.mutate({
      name,
      description: form.description.trim() || null,
      price,
      category: form.category.trim() || null,
      image_url: form.image_url.trim() || null,
      is_available: form.is_available,
      ...nutrition,
      allergens: form.allergens.trim() || null,
      is_vegan: form.is_vegan,
      is_flash_discount: form.is_flash_discount,
      flash_discount_percent: form.is_flash_discount && form.flash_discount_percent ? Number(form.flash_discount_percent) : 0,
    });
  };

  return (
    <Modal open onClose={onClose} title={isEdit ? `Edit "${item.name}"` : "Add menu item"}>
      <form onSubmit={handleSubmit} className="form-grid" noValidate>
        {error && (
          <div className="form-error form-error-span" role="alert">
            {error.message}
          </div>
        )}

        <label className="field">
          <span className="field-label">Name</span>
          <input className="input" value={form.name} onChange={set("name")} required autoFocus />
        </label>

        <label className="field">
          <span className="field-label">Price (₹)</span>
          <input
            className="input mono"
            type="number"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={set("price")}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Category</span>
          <input
            className="input"
            value={form.category}
            onChange={set("category")}
            placeholder="e.g. Snacks, Drinks, Bowls"
          />
        </label>

        <label className="field field-span">
          <span className="field-label">Allergens (comma-separated, e.g. dairy, peanuts, gluten)</span>
          <input
            className="input"
            value={form.allergens}
            onChange={set("allergens")}
            placeholder="dairy, peanuts, gluten, soy"
          />
        </label>

        {/* Nutrition & ingredients.
            Collapsed by default on a new item so the form reads as "name,
            price, done" for the common case of quickly listing a snack. Nothing
            in here is required, and leaving it blank is a normal outcome, not
            an incomplete form. */}
        <div className="field-span nutrition-form-section">
          <button
            type="button"
            className="nutrition-form-toggle"
            aria-expanded={showNutrition}
            onClick={() => setShowNutrition((v) => !v)}
          >
            <span className="nutrition-form-toggle-caret" aria-hidden="true">
              {showNutrition ? "▾" : "▸"}
            </span>
            Nutrition &amp; ingredients
            <span className="nutrition-form-optional muted">optional</span>
          </button>

          {showNutrition && (
            <div className="nutrition-form-body">
              <p className="nutrition-form-hint muted small">
                Add it if you have it. Students only ever see the figures you enter
                here - nothing is estimated for you, and an item with no data just
                shows no nutrition section.
              </p>

              <label className="field field-span">
                <span className="field-label">Ingredients (comma-separated)</span>
                <textarea
                  className="input textarea"
                  rows={2}
                  value={form.ingredients}
                  onChange={set("ingredients")}
                  placeholder="Paneer, bell peppers, onion, soy sauce, rice"
                />
              </label>

              <label className="field field-span">
                <span className="field-label">Serving size</span>
                <input
                  className="input"
                  value={form.serving_size}
                  onChange={set("serving_size")}
                  placeholder="e.g. 1 bowl (approx. 350g)"
                />
              </label>

              <label className="field">
                <span className="field-label">Calories (kcal)</span>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="1"
                  value={form.calories}
                  onChange={set("calories")}
                  placeholder="e.g. 350"
                />
              </label>

              <label className="field">
                <span className="field-label">Protein (g)</span>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.protein_g}
                  onChange={set("protein_g")}
                  placeholder="e.g. 18.5"
                />
              </label>

              <label className="field">
                <span className="field-label">Carbs (g)</span>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.carbs_g}
                  onChange={set("carbs_g")}
                  placeholder="e.g. 45.0"
                />
              </label>

              <label className="field">
                <span className="field-label">Fat (g)</span>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.fat_g}
                  onChange={set("fat_g")}
                  placeholder="e.g. 12.0"
                />
              </label>

              <label className="field">
                <span className="field-label">Fiber (g)</span>
                <input
                  className="input mono"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.fiber_g}
                  onChange={set("fiber_g")}
                  placeholder="e.g. 4.0"
                />
              </label>
            </div>
          )}
        </div>

        <label className="field field-span">
          <span className="field-label">Description</span>
          <textarea
            className="input textarea"
            rows={2}
            value={form.description}
            onChange={set("description")}
          />
        </label>

        <div className="field-span">
          <ImageUploader
            label="Item Photo (optional)"
            value={form.image_url}
            onUploaded={(url) => setForm((prev) => ({ ...prev, image_url: url }))}
            onRemove={() => setForm((prev) => ({ ...prev, image_url: "" }))}
          />
        </div>

        <div className="field-span" style={{ display: "flex", gap: "20px" }}>
          <label className="field-check">
            <input type="checkbox" checked={form.is_available} onChange={set("is_available")} />
            <span>Available to students</span>
          </label>
          <label className="field-check">
            <input type="checkbox" checked={form.is_vegan} onChange={set("is_vegan")} />
            <span>100% Vegan</span>
          </label>
        </div>

        {/* Operational Waste Reduction - Flash Discount */}
        <div className="field-span" style={{ background: "rgba(229,62,62,0.08)", border: "1px solid rgba(229,62,62,0.2)", borderRadius: "8px", padding: "12px" }}>
          <label className="field-check" style={{ marginBottom: form.is_flash_discount ? "10px" : 0 }}>
            <input type="checkbox" checked={form.is_flash_discount} onChange={set("is_flash_discount")} />
            <span style={{ fontWeight: 600, color: "#e53e3e" }}>Flash Discount / Surplus Food Sale</span>
          </label>
          {form.is_flash_discount && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
              <label className="field" style={{ margin: 0, flex: 1 }}>
                <span className="field-label small">Discount Percentage (%)</span>
                <input
                  className="input mono"
                  type="number"
                  min="5"
                  max="90"
                  step="5"
                  value={form.flash_discount_percent}
                  onChange={set("flash_discount_percent")}
                  placeholder="e.g. 20"
                />
              </label>
              <div className="small muted" style={{ flex: 1 }}>
                Effective Student Price: <strong className="mono" style={{ color: "#e53e3e" }}>
                  ₹{(Number(form.price || 0) * (1 - Number(form.flash_discount_percent || 0) / 100)).toFixed(2)}
                </strong>
              </div>
            </div>
          )}
        </div>

        <div className="btn-row field-span">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? <Spinner size="sm" /> : isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
