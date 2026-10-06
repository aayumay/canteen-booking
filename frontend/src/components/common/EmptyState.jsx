import Mascot from "./Mascot.jsx";

/**
 * Shared empty state.
 *
 * Uses the canteen mascot by default so every "nothing here" moment speaks with
 * the same voice. The mascot is the established precedent (see
 * NotificationsModal's caught-up state) and previously this component fell back
 * to a bare `···` glyph, so the app had two different empty-state identities.
 *
 * Pass `mascot={false}` where a character would be noise — a filtered table
 * that simply has no rows, for instance.
 */
export default function EmptyState({ title, hint, action, mascot = true, compact = false }) {
  return (
    <div className={`state state-empty${compact ? " state-compact" : ""}`}>
      {mascot ? (
        <span className="state-mascot" aria-hidden="true">
          <Mascot size={compact ? 40 : 52} variant="detailed" />
        </span>
      ) : (
        <span className="state-glyph state-glyph-quiet" aria-hidden="true">
          &middot;&middot;&middot;
        </span>
      )}
      <h3 className="state-title">{title}</h3>
      {hint && <p className="state-hint">{hint}</p>}
      {action}
    </div>
  );
}
