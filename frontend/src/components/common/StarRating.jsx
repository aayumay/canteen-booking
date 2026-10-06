import { useState } from "react";

export default function StarRating({
  rating = 0,
  onChange = null,
  size = "md",
  max = 5,
  showLabel = false,
  readOnly = false,
}) {
  const [hoverRating, setHoverRating] = useState(0);

  const isInteractive = !readOnly && Boolean(onChange);
  const activeRating = hoverRating || rating;

  return (
    <div
      className={`star-rating-wrap star-rating-${size} ${isInteractive ? "interactive" : "readonly"}`}
      role={isInteractive ? "radiogroup" : "img"}
      aria-label={`Rating: ${rating} out of ${max} stars`}
    >
      <div className="star-rating-stars">
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1;
          const isFilled = starValue <= activeRating;

          return (
            <button
              key={starValue}
              type="button"
              disabled={!isInteractive}
              className={`star-btn ${isFilled ? "star-filled" : "star-empty"}`}
              onClick={() => isInteractive && onChange(starValue)}
              onMouseEnter={() => isInteractive && setHoverRating(starValue)}
              onMouseLeave={() => isInteractive && setHoverRating(0)}
              aria-label={`${starValue} star${starValue > 1 ? "s" : ""}`}
              tabIndex={isInteractive ? 0 : -1}
            >
              ★
            </button>
          );
        })}
      </div>
      {showLabel && rating > 0 && (
        <span className="star-rating-label mono bold">
          {typeof rating === "number" ? rating.toFixed(1) : rating}
        </span>
      )}
    </div>
  );
}
