import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { studentApi } from "../../api/studentApi.js";
import StarRating from "../common/StarRating.jsx";
import ImageUploader from "../common/ImageUploader.jsx";
import { Spinner } from "../common/Spinner.jsx";
import { playPop } from "../../lib/sounds.js";

export default function ReviewBottomSheet({ order, open, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [error, setError] = useState(null);

  const mutation = useMutation({
    mutationFn: () =>
      studentApi.submitReview(order.id, {
        rating,
        comment: comment.trim() || null,
        photo_url: photoUrl.trim() || null,
      }),
    onSuccess: (data) => {
      playPop();
      queryClient.invalidateQueries({ queryKey: ["studentOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorReviews", order.vendor_id] });
      queryClient.invalidateQueries({ queryKey: ["openVendors"] });
      if (onSuccess) onSuccess(data);
      if (onClose) onClose();
    },
    onError: (err) => setError(err),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    if (!rating || rating < 1 || rating > 5) {
      setError(new Error("Please select a star rating between 1 and 5."));
      return;
    }
    mutation.mutate();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="modal-backdrop-healthy" onClick={onClose}>
        <motion.div
          className="review-sheet-modal"
          onClick={(e) => e.stopPropagation()}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
        >
          <div className="sheet-handle-bar" />

          <header className="review-sheet-header">
            <div>
              <h2 className="review-sheet-title">Rate your meal</h2>
              <p className="review-sheet-subtitle muted small">
                {order.vendor_name || "Canteen"} • Order #{order.pickup_token || order.id}
              </p>
            </div>
            <button
              type="button"
              className="review-sheet-close-btn"
              onClick={onClose}
              aria-label="Close review modal"
            >
              ✕
            </button>
          </header>

          <form onSubmit={handleSubmit} className="review-sheet-form">
            {error && (
              <div className="form-error" role="alert">
                {error.message}
              </div>
            )}

            {/* 1-5 Star Selector */}
            <div className="review-rating-box center-text">
              <span className="review-rating-prompt muted small">Tap a star to rate</span>
              <div className="review-stars-container">
                <StarRating rating={rating} onChange={setRating} size="lg" />
              </div>
              <span className="review-rating-status bold stat-lime">
                {rating === 5 && "Excellent"}
                {rating === 4 && "Very Good"}
                {rating === 3 && "Good"}
                {rating === 2 && "Fair"}
                {rating === 1 && "Needs Improvement"}
              </span>
            </div>

            {/* Comment Textarea */}
            <div className="field">
              <label htmlFor="review-comment" className="field-label">
                Feedback / Comments (optional)
              </label>
              <textarea
                id="review-comment"
                className="input textarea"
                rows={3}
                placeholder="How was the food quality, taste, and pickup speed?"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
              />
            </div>

            {/* Photo Upload */}
            <div className="field">
              <ImageUploader
                label="Attach a food photo (optional)"
                value={photoUrl}
                onUploaded={setPhotoUrl}
                onRemove={() => setPhotoUrl("")}
                compact
              />
            </div>

            {/* Actions */}
            <div className="review-sheet-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={mutation.isPending}
              >
                Skip for now
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? <Spinner size="sm" /> : "Submit Review"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
