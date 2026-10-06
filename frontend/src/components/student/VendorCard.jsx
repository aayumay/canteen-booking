import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { resolveImageUrl } from "../../lib/format.js";
import Mascot from "../common/Mascot.jsx";

export default function VendorCard({ vendor }) {
  const hasRating = vendor?.average_rating != null && vendor?.review_count > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.012 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link to={`/student/vendors/${vendor.id}`} className="vendor-card vendor-card-rich">
      <div className="vendor-card-media-box">
        {vendor?.stall_photo_url ? (
          <img
            src={resolveImageUrl(vendor.stall_photo_url)}
            alt={vendor.shop_name}
            className="vendor-card-img"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        ) : null}
        {!vendor?.stall_photo_url && (
          <div className="vendor-card-placeholder">
            <Mascot size={32} variant="detailed" />
          </div>
        )}
      </div>

      <div className="vendor-card-main">
        <h3 className="vendor-card-name">{vendor.shop_name}</h3>
        <div className="vendor-card-meta-row">
          <span className="vendor-card-open">
            <span className="open-dot" aria-hidden="true" />
            Open now
          </span>

          {hasRating ? (
            <span className="vendor-card-rating-pill">
              <span className="star-icon">★</span>
              <strong className="mono">{vendor.average_rating.toFixed(1)}</strong>
              <span className="vendor-review-count muted">({vendor.review_count})</span>
            </span>
          ) : (
            <span className="vendor-card-no-rating muted small">No reviews yet</span>
          )}
        </div>
      </div>
      <span className="vendor-card-cta" aria-hidden="true">
        Menu →
      </span>
    </Link>
    </motion.div>
  );
}

