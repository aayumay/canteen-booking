import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../hooks/useCart.jsx";
import { formatMoney } from "../../lib/format.js";
import {
  getFoodImage,
  getEstimatedPrepTime,
  getDishRating,
  getDishSubtitle,
} from "../../lib/foodImages.js";
import { playPop } from "../../lib/sounds.js";

export default function MenuItemCard({ item, vendor, onOpenDetail }) {
  const cart = useCart();
  const qty = cart.quantityOf(item.id);

  const imgUrl = getFoodImage(item);
  const prepTime = getEstimatedPrepTime(item);
  const rating = getDishRating(item);
  const subtitle = getDishSubtitle(item, vendor?.shop_name);

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    playPop();
    cart.addItem(item, vendor);
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    playPop();
    cart.increment(item.id);
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    playPop();
    cart.decrement(item.id);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -4, scale: 1.012 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className={`popular-dish-card ${qty > 0 ? "popular-dish-in-cart" : ""}`}
      onClick={() => onOpenDetail?.(item)}
    >
      {/* Top Image with Floating Orange Prep Time Badge */}
      <div className="popular-dish-media">
        <img
          src={imgUrl}
          alt={item.name}
          className="popular-dish-img"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
          }}
        />
        {item.is_flash_discount && item.flash_discount_percent > 0 ? (
          <div className="popular-dish-prep-badge mono" style={{ background: "#e53e3e", color: "#fff", fontWeight: 700 }}>
            {item.flash_discount_percent}% OFF
          </div>
        ) : (
          <div className="popular-dish-prep-badge mono">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ display: "inline-block", verticalAlign: "-1px", marginRight: "3px" }}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            {prepTime}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="popular-dish-body">
        <h3 className="popular-dish-title" title={item.name}>
          {item.name}
        </h3>
        <p className="popular-dish-subtitle" title={subtitle}>
          {subtitle}
        </p>

        {/* Bottom Price & Rating Row */}
        <div className="popular-dish-foot">
          <div className="popular-dish-price-pill mono" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            {item.is_flash_discount && item.flash_discount_percent > 0 ? (
              <>
                <span style={{ color: "#e53e3e", fontWeight: 700 }}>{formatMoney(item.effective_price ?? item.price)}</span>
                <span style={{ textDecoration: "line-through", color: "var(--color-text-muted)", fontSize: "0.75rem" }}>
                  {formatMoney(item.price)}
                </span>
              </>
            ) : (
              formatMoney(item.price)
            )}
          </div>

          <div className="popular-dish-rating">
            {item.calories ? (
              <span className="mono bold" style={{ fontSize: "0.75rem", color: "var(--color-forest)" }}>
                {item.calories} kcal {item.protein_g ? `• ${item.protein_g}g P` : ""}
              </span>
            ) : rating?.count > 0 ? (
              <>
                <span className="star-icon">★</span>
                <span className="rating-num bold">{rating.score}</span>
                <span className="rating-count muted">({rating.count})</span>
              </>
            ) : (
              <span className="rating-num small muted">Fresh</span>
            )}
          </div>

          {/* Quick Add / Stepper */}
          <div className="popular-dish-action" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait" initial={false}>
              {qty === 0 ? (
                <motion.button
                  key="add"
                  type="button"
                  className="popular-add-btn"
                  onClick={handleQuickAdd}
                  aria-label={`Add ${item.name} to cart`}
                  whileTap={{ scale: 0.85 }}
                >
                  +
                </motion.button>
              ) : (
                <motion.div
                  key="stepper"
                  className="popular-stepper-mini"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                >
                  <button
                    type="button"
                    className="stepper-mini-btn"
                    onClick={handleDecrement}
                  >
                    −
                  </button>
                  <span className="stepper-mini-qty mono">{qty}</span>
                  <button
                    type="button"
                    className="stepper-mini-btn"
                    onClick={handleIncrement}
                  >
                    +
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
