export default function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  retryLabel = "Try again",
}) {
  const message = error?.message ?? "Unexpected error.";
  return (
    <div className="state state-error" role="alert">
      <span className="state-glyph" aria-hidden="true">!</span>
      <h3 className="state-title">{title}</h3>
      <p className="state-hint">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
