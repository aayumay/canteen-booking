/**
 * Inline "this data may be stale" notice for live/polling views.
 *
 * In React Query v5 a failed background refetch sets `isRefetchError` and leaves
 * `status` at "success", so the previously fetched data stays on screen. That's
 * the right default — old data beats a blank page — but silently, which is how
 * a vendor ends up serving against a board that's two minutes out of date.
 *
 * This marks that state without blocking the view, and hands back a manual
 * escape hatch for when waiting out the next poll isn't good enough.
 *
 * Only for views that keep polling. A one-shot fetch that failed should use
 * ErrorState instead.
 */
export default function StaleStrip({
  isStale,
  onRetry,
  isRefetching = false,
  label = "This data may be out of date",
}) {
  if (!isStale) return null;

  return (
    <div className="stale-strip" role="status">
      <span className="stale-strip-text">{label}. We&rsquo;ll keep retrying.</span>
      <button type="button" className="stale-strip-action" onClick={onRetry} disabled={isRefetching}>
        {isRefetching ? "Refreshing…" : "Refresh now"}
      </button>
    </div>
  );
}
