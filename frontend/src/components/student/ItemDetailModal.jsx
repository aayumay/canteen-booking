import { useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../../hooks/useCart.jsx";
import { formatMoney } from "../../lib/format.js";
import {
  getFoodImage,
  getEstimatedPrepTime,
  getDishRating,
  getDishCalories,
  getDishIngredients,
  getDishNutrition,
} from "../../lib/foodImages.js";
import { playPop, playSuccess } from "../../lib/sounds.js";

export default function ItemDetailModal({ item, vendor, onClose }) {
  const cart = useCart();
  const qtyInCart = cart.quantityOf(item.id);
  const [localQty, setLocalQty] = useState(qtyInCart > 0 ? qtyInCart : 1);
  const [isFavorite, setIsFavorite] = useState(false);

  const imgUrl = getFoodImage(item);
  const prepTime = getEstimatedPrepTime(item);
  const rating = getDishRating(item);
  const calories = getDishCalories(item);
  const ingredients = getDishIngredients(item);
  const nutrition = getDishNutrition(item);

  const handleToggleFavorite = (e) => {
    e.stopPropagation();
    playPop();
    setIsFavorite(!isFavorite);
  };

  const handleIncrement = () => {
    playPop();
    setLocalQty((q) => q + 1);
  };

  const handleDecrement = () => {
    playPop();
    setLocalQty((q) => Math.max(1, q - 1));
  };

  const handleOrder = () => {
    playSuccess();
    // Add current quantity to cart
    cart.addItem(item, vendor);
    // If localQty > 1, update cart count
    for (let i = 1; i < localQty; i++) {
      cart.increment(item.id);
    }
    onClose();
  };

  const unitPrice = Number(item.effective_price ?? item.price);
  const totalPrice = unitPrice * localQty;

  const defaultDesc =
    item.description ||
    "This dish looks great on the plate because it is made fresh with whole quality ingredients and bright vegetables, which you can choose yourself, delighting in flavor and aroma.";

  return (
    <div className="modal-backdrop-healthy" onClick={onClose} role="presentation">
      <motion.div
        className="detail-sheet-healthy"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
      >
        {/* Hero Image with Back Button & Floating Lime Heart */}
        <div className="detail-hero-wrap">
          <img src={imgUrl} alt={item.name} className="detail-hero-img" />
          
          <button
            type="button"
            className="detail-back-btn"
            onClick={onClose}
            aria-label="Go back"
          >
            ←
          </button>

          <motion.button
            type="button"
            className={`detail-fav-btn ${isFavorite ? "detail-fav-active" : ""}`}
            onClick={handleToggleFavorite}
            aria-label="Add to favorites"
            whileTap={{ scale: 0.85 }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={isFavorite ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </motion.button>
        </div>

        {/* Detail Sheet Content */}
        <div className="detail-content-body">
          <h1 className="detail-title">{item.name}</h1>

          {/* Meta Info Row: Rating, Calories, Prep Time */}
          <div className="detail-meta-row">
            <div className="detail-rating">
              <span className="star-icon">★</span>
              <span className="rating-score bold">{rating?.score ?? "Fresh"}</span>
              {rating?.count > 0 && <span className="rating-count muted">({rating.count})</span>}
            </div>
            {calories && <span className="detail-calories muted">{calories}</span>}
            <div className="detail-prep-pill mono">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "4px" }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              {prepTime}
            </div>
          </div>

          {/* Details Section */}
          <div className="detail-section">
            <h3 className="detail-section-title">Details</h3>
            <p className="detail-description-text">{defaultDesc}</p>
          </div>

          {/* Nutrition.
              Rendered only when the vendor actually entered something. There is
              no fallback here: a dish with no nutrition data shows no panel at
              all, rather than zeros or a generic average, because a fabricated
              number on a nutrition label is a claim we cannot stand behind. */}
          {nutrition.hasAny && (
            <div className="detail-section">
              <h3 className="detail-section-title">Nutrition Facts</h3>

              {nutrition.servingSize && (
                <p className="nutrition-serving muted">Per {nutrition.servingSize}</p>
              )}

              {nutrition.calories !== null && (
                <div className="nutrition-calories">
                  <span className="nutrition-calories-value mono">{nutrition.calories}</span>
                  <span className="nutrition-calories-unit">kcal</span>
                </div>
              )}

              {/* The stacked bar and the percentages are only drawn when all
                  three macros are present, because the backend withholds
                  macro_percentages for partial data. Showing 40% protein /
                  60% fat on a dish whose carbs were left blank would
                  misrepresent the ratio. */}
              {nutrition.macros && (
                <div
                  className="nutrition-bar"
                  role="img"
                  aria-label={`Calorie split: protein ${nutrition.macros.protein_pct}%, carbs ${nutrition.macros.carbs_pct}%, fat ${nutrition.macros.fat_pct}%`}
                >
                  <span
                    className="nutrition-bar-seg nutrition-bar-protein"
                    style={{ width: `${nutrition.macros.protein_pct}%` }}
                  />
                  <span
                    className="nutrition-bar-seg nutrition-bar-carbs"
                    style={{ width: `${nutrition.macros.carbs_pct}%` }}
                  />
                  <span
                    className="nutrition-bar-seg nutrition-bar-fat"
                    style={{ width: `${nutrition.macros.fat_pct}%` }}
                  />
                </div>
              )}

              <dl className="nutrition-macros">
                {(
                  [
                    ["Protein", nutrition.protein, nutrition.macros?.protein_pct, "protein"],
                    ["Carbs", nutrition.carbs, nutrition.macros?.carbs_pct, "carbs"],
                    ["Fat", nutrition.fat, nutrition.macros?.fat_pct, "fat"],
                  ]
                )
                  // A macro left blank is omitted rather than shown as 0g:
                  // zero and unknown are different claims.
                  .filter(([, grams]) => grams !== null)
                  .map(([label, grams, pct, key]) => (
                    <div key={key} className="nutrition-macro">
                      <dt className="nutrition-macro-label">
                        <span className={`nutrition-swatch nutrition-swatch-${key}`} aria-hidden="true" />
                        {label}
                      </dt>
                      <dd className="nutrition-macro-value mono">
                        {grams}g
                        {pct !== null && pct !== undefined && (
                          <span className="nutrition-macro-pct muted"> ({pct}%)</span>
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>

              {nutrition.fiber !== null && (
                <div className="nutrition-fiber">
                  <span className="nutrition-macro-label">Fiber</span>
                  <span className="nutrition-macro-value mono">{nutrition.fiber}g</span>
                </div>
              )}
            </div>
          )}

          {/* Allergen Information */}
          {item.allergens && (
            <div className="detail-section" style={{ marginTop: "4px" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <span className="badge badge-orange small" style={{ fontWeight: 600 }}>
                  Contains: {item.allergens}
                </span>
                {item.is_vegan && (
                  <span className="badge badge-success small">100% Vegan</span>
                )}
              </div>
            </div>
          )}

          {/* Ingredients. Independent of the numeric nutrition above: an item
              can have ingredients but no macros, or macros but no ingredient
              list, and each half is shown only if it has content. */}
          {ingredients.length > 0 && (
            <div className="detail-section">
              <h3 className="detail-section-title">Ingredients</h3>
              <div className="detail-ingredients-row">
                {ingredients.map((ing, idx) => (
                  <span key={`${ing}-${idx}`} className="ingredient-chip">
                    <span className="ingredient-name">{ing}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Sticky Bottom Action Bar */}
          <div className="detail-footer-bar">
            <div className="detail-stepper-wrap">
              <button
                type="button"
                className="detail-stepper-btn"
                onClick={handleDecrement}
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="detail-stepper-val mono">{localQty}</span>
              <button
                type="button"
                className="detail-stepper-btn"
                onClick={handleIncrement}
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <motion.button
              type="button"
              className="detail-order-btn mono"
              onClick={handleOrder}
              whileTap={{ scale: 0.96 }}
            >
              Order for {formatMoney(totalPrice)}
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
