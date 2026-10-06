/* ============================================================================
 * Scrapbook page content.
 *
 * !! PLACEHOLDER CONTENT — READ BEFORE SHIPPING !!
 *
 * Every string in SATELLITES, POLAROIDS, JOURNEY, SCATTER and COMPARE_ROWS is
 * placeholder copy, marked below, and is NOT backed by data. The live
 * database currently holds 2 approved vendors, 9 menu items, 4 students and
 * zero orders / reviews / completed orders, so there is no real testimonial,
 * rating, or usage figure to print here. These were written to exercise the
 * layout. Replace each `placeholder: true` entry with something real, or delete
 * the section, before this page is shown to anyone.
 *
 * Images are real and reused from the existing landing page (see
 * lib/landingImages.js) rather than freshly invented Unsplash IDs, which would
 * be unverifiable and could 404. In particular SCATTER uses finished-dish
 * photos as stand-ins for cut-out ingredients: the repo has no transparent
 * ingredient PNGs, so supply those if you want true "floating strawberry"
 * cut-outs.
 * ========================================================================== */

import { GALLERY, HERO_IMAGES } from "../../lib/landingImages.js";

export const NAV_PILLS = [
  { label: "Nutrition", href: "#journey" },
  { label: "Benefits", href: "#compare" },
  { label: "Scrapbook", href: "#polaroids" },
  { label: "Ingredients", href: "#scatter" },
];

/* Small circular badges floating around the hero. */
export const SATELLITES = [
  {
    placeholder: true,
    value: "15 min",
    label: "pickup windows",
    className: "top-[6%] left-[3%]",
    rotate: -8,
  },
  {
    placeholder: true,
    value: "0",
    label: "minutes standing",
    className: "top-[22%] right-[2%]",
    rotate: 6,
  },
  {
    placeholder: true,
    value: "1 tap",
    label: "to pay",
    className: "bottom-[16%] left-[6%]",
    rotate: 5,
  },
  {
    placeholder: true,
    value: "0",
    label: "cold rotis",
    className: "bottom-[4%] right-[8%]",
    rotate: -5,
  },
];

/* Handwritten margin notes around the hero. */
export const HERO_NOTES = [
  { placeholder: true, text: "no queue!!", className: "top-[30%] left-[1%]", rotate: -6, underline: true },
  { placeholder: true, text: "book it friday", className: "top-[8%] right-[16%]", rotate: 5 },
  { placeholder: true, text: "wallah ₹45", className: "bottom-[24%] right-[0%]", rotate: 4, underline: true },
  { placeholder: true, text: "token > shouting", className: "bottom-[8%] left-[14%]", rotate: -4 },
];

/* Rubber stamps, as opposed to handwriting. Kept separate so the two
   annotation languages stay visually distinct. */
export const HERO_STAMPS = [
  { placeholder: true, text: "Paid", className: "left-[2%] bottom-[30%]", rotate: -11, size: "text-base" },
  { placeholder: true, text: "Ready", className: "right-[3%] top-[26%]", rotate: 9, size: "text-sm" },
];

/* The docket hanging out of the hero photo. */
export const HERO_DOCKET = {
  placeholder: true,
  serial: "TKT-4471",
  window: "14:15 – 14:30",
  stall: "Chai & Snacks",
  barcode: "TKT-4471-1415",
  note: "PLACEHOLDER — sample ticket, no order exists",
};

/* The scattered Polaroid pile. */
export const POLAROIDS = [
  {
    placeholder: true,
    image: GALLERY[0].image,
    caption: GALLERY[0].caption,
    quote: "PLACEHOLDER QUOTE — no reviews exist yet",
    alt: GALLERY[0].caption,
    className:
      "left-[2%] top-[6%] rotate-[-7deg] z-20 w-[210px] sm:w-[240px]",
  },
  {
    placeholder: true,
    image: GALLERY[3].image,
    caption: GALLERY[3].caption,
    quote: "PLACEHOLDER QUOTE — no reviews exist yet",
    alt: GALLERY[3].caption,
    className:
      "left-[30%] top-[0%] rotate-[5deg] z-30 w-[220px] sm:w-[250px]",
  },
  {
    placeholder: true,
    image: GALLERY[6].image,
    caption: GALLERY[6].caption,
    quote: "PLACEHOLDER QUOTE — no reviews exist yet",
    alt: GALLERY[6].caption,
    className:
      "right-[4%] top-[10%] rotate-[-4deg] z-10 w-[200px] sm:w-[230px]",
  },
  {
    placeholder: true,
    image: GALLERY[7].image,
    caption: GALLERY[7].caption,
    quote: "PLACEHOLDER QUOTE — no reviews exist yet",
    alt: GALLERY[7].caption,
    className:
      "left-[12%] top-[46%] rotate-[8deg] z-40 w-[215px] sm:w-[245px]",
  },
  {
    placeholder: true,
    image: GALLERY[4].image,
    caption: GALLERY[4].caption,
    quote: "PLACEHOLDER QUOTE — no reviews exist yet",
    alt: GALLERY[4].caption,
    className:
      "right-[16%] top-[50%] rotate-[-6deg] z-20 w-[205px] sm:w-[235px]",
  },
];

/* Four cards pinned along the winding spine, alternating sides. */
export const JOURNEY = [
  {
    placeholder: true,
    step: "01",
    kicker: "Pick your window",
    title: "Reserve a slot, not a queue",
    body: "PLACEHOLDER — describe the pickup-window flow.",
    side: "left",
    top: "0%",
  },
  {
    placeholder: true,
    step: "02",
    kicker: "Pay your way",
    title: "Wallet, meal pass, or counter",
    body: "PLACEHOLDER — describe the payment options.",
    side: "right",
    top: "26%",
  },
  {
    placeholder: true,
    step: "03",
    kicker: "Watch it land",
    title: "Live status to ready",
    body: "PLACEHOLDER — describe live order tracking.",
    side: "left",
    top: "52%",
  },
  {
    placeholder: true,
    step: "04",
    kicker: "Collect it hot",
    title: "Show the token, eat",
    body: "PLACEHOLDER — describe pickup with the token.",
    side: "right",
    top: "78%",
  },
];

/* Central dish plus the scattered "ingredients". */
export const SCATTER = {
  centre: {
    image: HERO_IMAGES.main,
    alt: "A freshly plated meal",
    docket: "Menu · today",
  },
  /*
   * Finished-dish photos standing in for cut-out ingredients. The repo has no
   * transparent ingredient art; drop real PNG cut-outs in and swap the src.
   */
  pieces: [
    { image: HERO_IMAGES.greens, alt: "A bowl of greens", className: "left-[4%] top-[14%] z-20 w-[120px] rotate-[-11deg] sm:w-[150px]" },
    { image: GALLERY[5].image, alt: GALLERY[5].caption, className: "right-[6%] top-[8%] z-30 w-[105px] rotate-[9deg] sm:w-[135px]" },
    { image: GALLERY[2].image, alt: GALLERY[2].caption, className: "right-[2%] bottom-[18%] z-10 w-[130px] rotate-[-6deg] sm:w-[160px]" },
    { image: GALLERY[1].image, alt: GALLERY[1].caption, className: "left-[10%] bottom-[10%] z-40 w-[110px] rotate-[13deg] sm:w-[140px]" },
  ],
};

/* The stark table. Comparisons are against the general walk-up model, not a
 * named competitor, and the metric rows are placeholders. */
export const COMPARE_ROWS = [
  {
    placeholder: true,
    label: "Wait at the counter",
    us: "A booked window, already paid",
    them: "Unpredictable queue",
  },
  {
    placeholder: true,
    label: "Order status",
    us: "Live, accepted → ready",
    them: "Ask the vendor",
  },
  {
    placeholder: true,
    label: "Payment",
    us: "Wallet, meal pass or counter",
    them: "Cash at the till",
  },
  {
    placeholder: true,
    label: "Nutrition detail",
    us: "Per-dish macros and allergens",
    them: "Not published",
  },
  {
    placeholder: true,
    label: "Reclaim a cancelled order",
    us: "Auto-refunded to the wallet",
    them: "Ask for a refund",
  },
];

/* Header, verdict row and stamp, composed around COMPARE_ROWS so the table
 * can stay a plain list of label/us/them triples. */
export const COMPARE = {
  sub: "Walk-up vs. pre-booked",
  head: { left: "Walking up", right: "Pre-booked" },
  outcome: { left: "40 min, maybe", right: "Slot, on time" },
  stamp: "Book it",
  placeholderNote:
    "Placeholder figures — not measured, and not a named competitor",
};

/* Footer chips, each in its own floating white circle. */
export const FOOTER_CHIPS = [
  { placeholder: true, label: "UPI", className: "left-[6%] top-[8%] rotate-[-7deg]" },
  { placeholder: true, label: "Wallet", className: "left-[28%] top-[42%] rotate-[5deg]" },
  { placeholder: true, label: "Meal pass", className: "right-[30%] top-[14%] rotate-[-4deg]" },
  { placeholder: true, label: "Cash", className: "right-[8%] top-[52%] rotate-[8deg]" },
];
