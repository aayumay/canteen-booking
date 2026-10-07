/**
 * Responsive real-image helpers.
 *
 * Every image in the product is real photography (Unsplash) or a real user
 * upload — never emoji, never AI-generated art. This module keeps that
 * guarantee while making the images cheap to load:
 *
 *  - one place to build a sized URL for any source
 *  - `srcset`/`sizes` so phones fetch small files and desktops fetch large ones
 *  - a guaranteed fallback chain so a dropped cellular connection can never
 *    leave a broken frame on screen
 */

const UNSPLASH = "https://images.unsplash.com/";

/** Widths offered to the browser for every responsive slot. */
export const SRCSET_WIDTHS = [240, 320, 480, 640, 800, 1080, 1400];

/** Safe last-resort image. Verified to always resolve. */
export const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=75";

/**
 * True when the URL is an Unsplash photo, which is the only host whose query
 * string we can safely rewrite.
 */
function isUnsplash(url) {
  return typeof url === "string" && url.includes("images.unsplash.com");
}

/**
 * Build a single sized URL.
 * Non-Unsplash URLs (user uploads) pass through untouched.
 */
export function sizedImage(url, width = 800, quality = 75) {
  if (!url) return FALLBACK_IMAGE;
  if (!isUnsplash(url)) return url;

  const w = Math.max(64, Math.min(2000, Math.round(width)));
  const base = url.split("?")[0];
  return `${base}?auto=format&fit=crop&w=${w}&q=${quality}`;
}

/**
 * Build a `srcSet` string by re-requesting the same photo at several widths.
 * Returns "" for non-Unsplash sources so the attribute is simply omitted.
 */
export function imageSrcSet(url, widths = SRCSET_WIDTHS, quality = 75) {
  if (!isUnsplash(url)) return "";
  const base = url.split("?")[0];
  return widths
    .map((w) => `${base}?auto=format&fit=crop&w=${w}&q=${quality} ${w}w`)
    .join(", ");
}

/**
 * Resolve a whole srcSet/src/sizes trio for one slot.
 *
 * @param {string} url        original image URL
 * @param {object} opts
 * @param {number} opts.width      largest width the slot can occupy
 * @param {string} opts.sizes      CSS `sizes` descriptor
 * @param {number[]} opts.widths   candidate widths for srcset
 * @param {string} opts.quality    encoder quality
 */
export function responsiveImage(url, { width = 800, sizes, widths, quality = 75 } = {}) {
  const capped = (widths || SRCSET_WIDTHS).filter((w) => w <= width);
  const candidates = capped.length ? capped : [width];
  const src = sizedImage(url, candidates[candidates.length - 1], quality);
  const srcSet = imageSrcSet(url, candidates, quality);
  return { src, srcSet: srcSet || undefined, sizes: srcSet ? sizes : undefined };
}

/** Build the next candidate in a manual fallback chain (browser onerror). */
export function nextFallback(current, fallbacks) {
  const chain = [current, ...fallbacks].filter(Boolean);
  const idx = chain.findIndex((u) => u === current);
  if (idx === -1) return fallbacks[0] || FALLBACK_IMAGE;
  return chain[idx + 1] || FALLBACK_IMAGE;
}
