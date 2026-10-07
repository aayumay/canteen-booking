import { resolveImageUrl } from "./format.js";

export const FOOD_IMAGES = {
  soup: "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&q=80",
  salmon: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80",
  salad: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80",
  sushi: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&q=80",
  pizza: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80",
  cake: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80",
  drinks: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=600&q=80",
  burger: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80",
  sandwich: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80",
  fries: "https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80",
  pasta: "https://images.unsplash.com/photo-1621996346565-e3d5d62816f1?auto=format&fit=crop&w=600&q=80",
  bowls: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
  default: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
};

export const CATEGORIES_WITH_ICONS = [
  {
    id: "All",
    label: "All Dishes",
    image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "Salads",
    label: "Salads",
    image: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "Sushi",
    label: "Sushi",
    image: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "Pizza",
    label: "Pizza",
    image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "Cakes",
    label: "Cakes",
    image: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "Drinks",
    label: "Drinks",
    image: "https://images.unsplash.com/photo-1556881286-fc6915169721?auto=format&fit=crop&w=200&q=80",
  },
  {
    id: "Bowls",
    label: "Bowls",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80",
  },
];

export const DISCOVER_PLACES = [
  {
    id: 1,
    name: "Healthy Store",
    image: "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=200&q=80",
    color: "#335C30",
  },
  {
    id: 2,
    name: "Fresh Kitchen",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80",
    color: "#4A7D46",
  },
  {
    id: 3,
    name: "Fish & Wine",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=200&q=80",
    color: "#8B6914",
  },
  {
    id: 4,
    name: "Sea Food Bistro",
    image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=200&q=80",
    color: "#3B6E8C",
  },
  {
    id: 5,
    name: "Chai & Snacks",
    image: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=200&q=80",
    color: "#B84040",
  },
];

export function getFoodImage(item) {
  if (item?.image_url && item.image_url.trim()) {
    return resolveImageUrl(item.image_url.trim());
  }
  const text = `${item?.name || ""} ${item?.category || ""} ${item?.description || ""}`.toLowerCase();
  
  if (text.includes("salmon") || text.includes("fish")) return FOOD_IMAGES.salmon;
  if (text.includes("soup") || text.includes("pumpkin")) return FOOD_IMAGES.soup;
  if (text.includes("salad") || text.includes("green")) return FOOD_IMAGES.salad;
  if (text.includes("sushi") || text.includes("roll")) return FOOD_IMAGES.sushi;
  if (text.includes("pizza")) return FOOD_IMAGES.pizza;
  if (text.includes("cake") || text.includes("dessert") || text.includes("sweet")) return FOOD_IMAGES.cake;
  if (text.includes("smoothie") || text.includes("shake") || text.includes("drink") || text.includes("tea") || text.includes("coffee")) return FOOD_IMAGES.drinks;
  if (text.includes("burger")) return FOOD_IMAGES.burger;
  if (text.includes("sandwich")) return FOOD_IMAGES.sandwich;
  if (text.includes("fries")) return FOOD_IMAGES.fries;
  if (text.includes("pasta") || text.includes("noodles")) return FOOD_IMAGES.pasta;
  if (text.includes("bowl") || text.includes("rice") || text.includes("curry") || text.includes("thali")) return FOOD_IMAGES.bowls;

  return FOOD_IMAGES.default;
}

export function getEstimatedPrepTime(item) {
  if (item?.prep_time_minutes != null && Number(item.prep_time_minutes) > 0) {
    return `${item.prep_time_minutes} min`;
  }
  return "10 min";
}

export function getDishRating(item) {
  if (item?.average_rating != null && Number(item.average_rating) > 0) {
    return {
      score: Number(item.average_rating).toFixed(1),
      count: item.review_count || 0,
    };
  }
  return {
    score: "New",
    count: 0,
  };
}

export function getDishCalories(item) {
  if (item?.calories != null && Number(item.calories) > 0) {
    return `${item.calories} kcal`;
  }
  return null;
}

export function getDishSubtitle(item, vendorName) {
  if (vendorName) return vendorName;
  if (item?.category) return item.category;
  return "";
}

/**
 * Vendor-entered ingredients, split into a display list.
 *
 * Stored as one free-text column because vendors describe a dish in their own
 * words, so the same list may be comma- or newline-separated. This only
 * reformats what the vendor typed: it never invents, completes or looks up an
 * ingredient. An item with no ingredients yields [].
 */
export function getDishIngredients(item) {
  const raw = item?.ingredients;
  if (!raw || typeof raw !== "string") return [];

  const seen = new Set();
  return raw
    .split(/[,\n;]/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const key = part.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Normalised nutrition for display.
 *
 * Every field is null when the vendor left it blank - this never substitutes a
 * default, an average, or an estimate, so a dish with no data comes back empty
 * and the caller can hide the whole section rather than render zeros that look
 * measured.
 *
 * `macros` is null unless all three macros are real numbers, which mirrors the
 * backend's `macro_percentages` being null for incomplete data: a stacked bar
 * built from a missing carb value would imply the carbs contribute nothing.
 */
export function getDishNutrition(item) {
  const num = (value) => {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };

  const calories = num(item?.calories);
  const protein = num(item?.protein_g);
  const carbs = num(item?.carbs_g);
  const fat = num(item?.fat_g);
  const fiber = num(item?.fiber_g);
  const servingSize = item?.serving_size?.trim() || null;

  const hasAny =
    calories !== null || protein !== null || carbs !== null || fat !== null || fiber !== null;

  return {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    servingSize,
    hasAny,
    // Prefer the backend's computed ratio; it is authoritative. The local
    // fallback only covers a response that predates the field, and applies the
    // same all-or-nothing rule.
    macros: item?.macro_percentages ?? null,
  };
}

export function matchesDietaryPreference(item, preference = "all") {
  if (!preference || preference === "all") return true;
  const text = `${item?.name || ""} ${item?.category || ""} ${item?.description || ""}`.toLowerCase();
  
  if (preference === "veg") {
    // Pure vegetarian: no meat, poultry, fish, egg
    return !text.includes("chicken") && !text.includes("meat") && !text.includes("egg") && !text.includes("fish") && !text.includes("salmon") && !text.includes("mutton") && !text.includes("beef") && !text.includes("pork");
  }
  
  if (preference === "vegan") {
    // Vegan: no meat, fish, egg, dairy/cheese/paneer/milk/butter
    const nonVegan = ["chicken", "meat", "egg", "fish", "salmon", "mutton", "beef", "pork", "cheese", "paneer", "milk", "butter", "cream", "curd", "ghee", "yogurt"];
    return !nonVegan.some((nv) => text.includes(nv));
  }
  
  if (preference === "halal") {
    // Halal / organic: no pork, no alcohol
    return !text.includes("pork") && !text.includes("bacon") && !text.includes("wine") && !text.includes("beer");
  }
  
  return true;
}

export function isVegItem(item) {
  return matchesDietaryPreference(item, "veg");
}
