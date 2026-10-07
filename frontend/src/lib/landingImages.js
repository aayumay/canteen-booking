/**
 * Real photography for the landing page.
 *
 * Every URL below is a real photograph hosted on Unsplash — no emoji, no
 * illustration, no AI-generated imagery anywhere in the product. The URLs are
 * stored bare (no query string) so `responsiveImage()` can generate a correct
 * `srcset` for each slot at runtime.
 */

const U = (id) => `https://images.unsplash.com/photo-${id}`;

/* ------------------------------------------------------------------ *
 * Hero collage
 * ------------------------------------------------------------------ */
export const HERO_IMAGES = {
  // LCP candidate — a hot, freshly plated thali
  main: U("1631452180519-c014fe946bc7"),
  // Warm counter shot
  counter: U("1414235077428-338989a2e8c0"),
  // Fresh greens
  greens: U("1512621776951-a57141f2eefd"),
  // A student lifting a meal
  student: U("1498837167922-ddd27525d352"),
};

/* ------------------------------------------------------------------ *
 * The three "how it works" moments
 * ------------------------------------------------------------------ */
export const STEPS = [
  {
    step: "01",
    kicker: "Pick your window",
    title: "Reserve a 15-minute slot",
    body: "Every stall publishes its pickup windows with live capacity. Choose the minute your lecture ends and the kitchen starts cooking for you.",
    image: U("1521305916504-4a1121188589"),
    alt: "A freshly made sandwich on a wooden board",
  },
  {
    step: "02",
    kicker: "Pay in one tap",
    title: "Spend your campus wallet",
    body: "Top up once, then pay from your prepaid balance, a meal pass credit, or at the counter. Every rupee lands in a ledger you can actually read.",
    image: U("1556909114-f6e7ad7d3136"),
    alt: "Hands opening a leather wallet",
  },
  {
    step: "03",
    kicker: "Walk straight in",
    title: "Show your token, eat hot",
    body: "A live ticket follows your order from accepted to ready, with a six-digit pickup token. No queue, no shouting, no cold rotis.",
    image: U("1559847844-5315695dadae"),
    alt: "A hot Indian thali served fresh",
  },
];

/* ------------------------------------------------------------------ *
 * Feature bento grid
 * ------------------------------------------------------------------ */
export const FEATURES = [
  {
    icon: "clock",
    title: "Slot-based pickup",
    body: "Reserve a window, not a queue. Live capacity per stall means your food is plated for the minute you arrive.",
    size: "wide",
  },
  {
    icon: "wallet",
    title: "Prepaid campus wallet",
    body: "Top up, spend, and read a real double-entry ledger. Auto-refund the moment an order is cancelled.",
    size: "tall",
  },
  {
    icon: "shield",
    title: "Nutrition & allergens",
    body: "Calories, macros, and a hard allergen filter. Vegan, pure-veg, and halal preferences follow you across every stall.",
    size: "normal",
  },
  {
    icon: "cap",
    title: "Meal passes",
    body: "Buy a 10-thali lunch pack once and burn one credit per order. Track meals left and expiry in your wallet.",
    size: "normal",
  },
  {
    icon: "dabba",
    title: "Zero-waste options",
    body: "Decline cutlery or bring your own dabba and take ₹5 off. Your plastic saved is counted on your profile.",
    size: "normal",
  },
  {
    icon: "pin",
    title: "Lecture-break timing",
    body: "Add your timetable and the app tells you exactly when to order so the food is ready as you walk out.",
    size: "wide",
  },
];

/* ------------------------------------------------------------------ *
 * "What's on the counter" gallery
 * ------------------------------------------------------------------ */
export const GALLERY = [
  {
    image: U("1567188040759-fb8a883dc6d8"),
    caption: "Chai & Snacks",
    note: "Cutting chai, 4 minutes",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1585937421612-70a008356fbe"),
    caption: "Fresh Kitchen",
    note: "Dal, rice, two sabzi",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1601050690597-df0568f70950"),
    caption: "The Fry Counter",
    note: "Samosa & pakora, 6 minutes",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1512621776951-a57141f2eefd"),
    caption: "Green Room",
    note: "Salads bowl, 3 minutes",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1567620905732-2d1ec7ab7445"),
    caption: "Breakfast Club",
    note: "Pancake stack, 8 minutes",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1524350876685-274059332603"),
    caption: "Steaming Pot",
    note: "Masala chai, 2 minutes",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1541014741259-de529411b96a"),
    caption: "Grill House",
    note: "Skewers, 10 minutes",
    width: 1200,
    height: 1500,
  },
  {
    image: U("1509440159596-0249088772ff"),
    caption: "The Bakery",
    note: "Breads & buns, 2 minutes",
    width: 1200,
    height: 1500,
  },
];

/* ------------------------------------------------------------------ *
 * Full-bleed parallax band
 * ------------------------------------------------------------------ */
export const BAND_IMAGE = {
  image: U("1552566626-52f8b828add9"),
  alt: "A busy campus canteen counter at lunchtime",
  width: 2000,
  height: 1200,
};

/* ------------------------------------------------------------------ *
 * FAQ
 * ------------------------------------------------------------------ */
export const FAQS = [
  {
    q: "Who can use Canteen Booking?",
    a: "Any student on campus. Sign in with your phone number — no password, no email, no student ID scan. Canteen partners get their own vendor portal, and the institution admin manages stalls, balances, and announcements from one dashboard.",
  },
  {
    q: "What if my order is late or wrong?",
    a: "Cancel before the stall starts cooking and the full amount goes back to your wallet automatically, logged in the ledger. If the stall rejects your order for any reason, the refund is equally automatic — you never have to chase a counter clerk.",
  },
  {
    q: "How do the allergen filters work?",
    a: "Set your exclusions once in Profile. Every menu item carries real nutrition macros and allergen tags, and anything conflicting is filtered out of the menu before you see it — not greyed out afterwards.",
  },
  {
    q: "Can I eat a meal pass at any stall?",
    a: "Passes belong to the canteen partner who sold them. If you hold an active pass for a stall, Checkout offers it automatically and debits one credit. You can track meals remaining and expiry from your wallet.",
  },
  {
    q: "Does it work on a slow connection?",
    a: "Yes. The app caches your last known menu and stalls, every image is served at the exact size your screen needs, and a dropped network swaps in a local fallback rather than a broken frame.",
  },
];

export { U as unsplashPhoto };
