import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Persistent, unobtrusive connection notice.
 *
 * Deliberately not an ErrorState: losing the network isn't an error the user
 * caused or can dismiss, and replacing the page with a red panel would be worse
 * than the outage. It stays put and only leaves once a real request succeeds.
 *
 * Publishes its own height as `--connection-banner-h` so the sticky app bar can
 * drop below it instead of hiding underneath — the banner's text wraps to two
 * lines on narrow screens, so a hard-coded offset would be wrong on exactly the
 * devices that can least afford to lose the header.
 */
export default function ConnectionBanner({ isOffline, onRetry }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!isOffline) {
      root.classList.remove("has-connection-banner");
      root.style.removeProperty("--connection-banner-h");
      return undefined;
    }

    const el = ref.current;
    const publish = () => {
      if (el) root.style.setProperty("--connection-banner-h", `${el.offsetHeight}px`);
    };
    publish();

    // Text reflows on rotate and on font load, so re-measure rather than trust
    // the first paint.
    const observer = new ResizeObserver(publish);
    if (el) observer.observe(el);
    window.addEventListener("resize", publish);

    root.classList.add("has-connection-banner");
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", publish);
      root.classList.remove("has-connection-banner");
      root.style.removeProperty("--connection-banner-h");
    };
  }, [isOffline]);

  // Keep the document title honest so a backgrounded tab still tells the truth.
  useEffect(() => {
    if (!isOffline) return undefined;
    const previous = document.title;
    document.title = "Offline — Canteen Booking";
    return () => {
      document.title = previous;
    };
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <div className="connection-banner" role="status" aria-live="polite" ref={ref}>
      <span className="connection-banner-dot" aria-hidden="true" />
      <span className="connection-banner-text">
        You&rsquo;re offline &mdash; showing the last known data. We&rsquo;ll refresh
        automatically once you&rsquo;re back.
      </span>
      <button type="button" className="connection-banner-action" onClick={onRetry}>
        Refresh now
      </button>
    </div>
  );
}
