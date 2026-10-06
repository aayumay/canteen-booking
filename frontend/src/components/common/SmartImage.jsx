import { useCallback, useMemo, useState } from "react";
import { FALLBACK_IMAGE, responsiveImage } from "../../lib/images.js";

/**
 * A real photograph that always renders, never shifts layout, and never asks
 * the browser to decode more pixels than the slot can show.
 *
 * @param {string} src        real image URL (Unsplash photo or user upload)
 * @param {string} alt        required for a11y
 * @param {number} width      intrinsic width in px
 * @param {number} height     intrinsic height in px — supply this to reserve space
 * @param {string} sizes      CSS sizes descriptor
 * @param {number[]} widths   srcset candidates
 * @param {string} className
 * @param {object} style
 * @param {string} fallback   optional extra hop before the global fallback
 * @param {"eager"|"lazy"} loading
 * @param {boolean} priority  true for the LCP image (sets fetchpriority)
 */
export default function SmartImage({
  src,
  alt,
  width = 800,
  height = 600,
  sizes,
  widths,
  quality = 75,
  className = "",
  style,
  fallback,
  loading = "lazy",
  priority = false,
  onLoad,
  ...rest
}) {
  // The fallback chain for *this* src, de-duplicated. Pure, so it is safe to
  // build during render.
  const chain = useMemo(
    () => [...new Set([src || FALLBACK_IMAGE, fallback, FALLBACK_IMAGE].filter(Boolean))],
    [src, fallback]
  );

  // We track a *position in the chain* rather than a separate URL, and key it by
  // src. When src changes, the stored index no longer applies and we read 0 —
  // so switching between two broken images never leaves us stranded on a
  // fallback, and no extra render pass is needed to reset anything.
  const [attempt, setAttempt] = useState({ key: src, index: 0 });
  const index = attempt.key === src ? attempt.index : 0;

  // Clamp to the end of the chain: if the fallback itself 404s we stay put
  // rather than retrying the same URL forever.
  const current = chain[Math.min(index, chain.length - 1)];

  // Descriptors describe the URL actually being rendered, so a fallback hop
  // gets its own correctly-sized srcset instead of the original photo's.
  const resolved = useMemo(
    () => responsiveImage(current, { width, sizes, widths, quality }),
    [current, width, sizes, widths, quality]
  );

  const last = chain.length - 1;
  const handleError = useCallback(() => {
    setAttempt((prev) => {
      const from = prev.key === src ? prev.index : 0;
      return { key: src, index: Math.min(from + 1, last) };
    });
  }, [src, last]);

  return (
    <img
      src={resolved.src}
      srcSet={resolved.srcSet}
      sizes={resolved.sizes}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      loading={priority ? "eager" : loading}
      decoding={priority ? "sync" : "async"}
      // Must be lowercase: React 18 does not recognise the camelCase
      // `fetchPriority` prop and silently drops it, which loses the LCP hint.
      fetchpriority={priority ? "high" : undefined}
      onError={handleError}
      onLoad={onLoad}
      {...rest}
    />
  );
}
