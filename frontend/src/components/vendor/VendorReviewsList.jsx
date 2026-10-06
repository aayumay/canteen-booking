import { useQuery } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import StarRating from "../common/StarRating.jsx";
import { Spinner } from "../common/Spinner.jsx";
import EmptyState from "../common/EmptyState.jsx";
import ErrorState from "../common/ErrorState.jsx";
import { formatRelativeTime, resolveImageUrl } from "../../lib/format.js";

export default function VendorReviewsList() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["ownVendorReviews"],
    queryFn: () => vendorApi.fetchOwnReviews(),
  });

  if (isLoading) {
    return (
      <div className="center-row">
        <Spinner size="lg" label="Loading customer reviews" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={refetch} />;
  }

  const reviews = data?.items || [];
  const avgRating = data?.average_rating;
  const reviewCount = data?.review_count || 0;

  if (reviews.length === 0) {
    return (
      <EmptyState
        title="No reviews yet"
        hint="Customer reviews will appear here once students pick up and rate their orders."
      />
    );
  }

  return (
    <div className="vendor-reviews-container">
      {/* Vendor Rating Summary Banner */}
      <div className="vendor-reviews-summary-card">
        <div className="summary-rating-big mono bold">
          {avgRating ? avgRating.toFixed(1) : "—"}
        </div>
        <div className="summary-rating-details">
          <StarRating rating={avgRating || 0} readOnly size="md" />
          <span className="muted small">
            Based on {reviewCount} verified student {reviewCount === 1 ? "review" : "reviews"}
          </span>
        </div>
      </div>

      {/* Review Cards List */}
      <div className="reviews-feed-list">
        {reviews.map((r) => (
          <div key={r.id} className="review-feed-card">
            <div className="review-card-head">
              <div className="reviewer-info">
                <div className="reviewer-avatar">
                  {r.reviewer_name[0]?.toUpperCase() || "S"}
                </div>
                <div>
                  <h4 className="reviewer-name">{r.reviewer_name}</h4>
                  <span className="review-time muted small mono">
                    {formatRelativeTime(r.created_at)}
                  </span>
                </div>
              </div>
              <StarRating rating={r.rating} readOnly size="sm" />
            </div>

            {r.comment && <p className="review-comment-text">{r.comment}</p>}

            {r.photo_url && (
              <div className="review-photo-attachment">
                <img
                  src={resolveImageUrl(r.photo_url)}
                  alt="Review attachment"
                  className="review-photo-img"
                  loading="lazy"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
