import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../../hooks/useCart.jsx";
import { formatMoney } from "../../lib/format.js";
import { playPop } from "../../lib/sounds.js";

/**
 * Mobile-only floating cart summary.
 *
 * At tablet and above this is not rendered at all: the left rail carries a
 * docked cart panel instead, so there is no floating bar overlapping content.
 * The checkout surface itself is owned by StudentLayout, which means there is
 * exactly one CheckoutSheet in the tree no matter which control opened it.
 */
export default function CartBar({ onOpenCart }) {
  const { totalItems, subtotal } = useCart();

  const handleOpen = (e) => {
    e?.stopPropagation();
    playPop();
    onOpenCart();
  };

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.aside
          className="cartbar-floating"
          initial={{ y: 80, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 450, damping: 28 }}
          aria-label="Floating cart summary"
        >
          <div className="cartbar-inner" onClick={handleOpen}>
            <div className="cartbar-info">
              <div className="cartbar-icon-wrap" aria-hidden="true">
                <svg
                  className="cartbar-bag-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
              </div>
              <div className="cartbar-text">
                <motion.span
                  key={totalItems}
                  initial={{ scale: 1.2, color: "#A6E22E" }}
                  animate={{ scale: 1, color: "#F5F5F0" }}
                  transition={{ duration: 0.2 }}
                  className="cartbar-count-label"
                >
                  {totalItems} {totalItems === 1 ? "item" : "items"}
                </motion.span>
                <span className="cartbar-dot">•</span>
                <span className="cartbar-amount mono">{formatMoney(subtotal)}</span>
              </div>
            </div>

            <motion.button
              type="button"
              className="cartbar-cta-btn"
              whileTap={{ scale: 0.96 }}
              onClick={handleOpen}
            >
              View Cart →
            </motion.button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
