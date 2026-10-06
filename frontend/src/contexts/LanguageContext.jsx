import { createContext, useContext, useEffect } from "react";

const translations = {
  en: {
    // Navigation
    home: "Home",
    orders: "Orders",
    cart: "Cart",
    profile: "Profile",
    logout: "Log out",
    wallet: "Prepaid Wallet",
    meal_plans: "Meal Passes",
    schedule: "Timetable",
    leaderboard: "Leaderboard",

    // Header & Brand
    canteen: "Canteen",
    booking: "Booking",
    ordering_from: "Ordering from",

    // Actions & Buttons
    confirm_order: "Confirm Order",
    add_to_tray: "Add to Tray",
    details: "Details",
    nutrition: "Nutrition Facts",
    ingredients: "Ingredients",
    save: "Save",
    clear: "Clear",
    cancel: "Cancel",

    // Sustainability & Eco
    green_impact: "My Green Campus Impact",
    eco_choices: "Campus Sustainability & Eco-Choices",
    cutlery_standard: "Standard Cutlery & Napkins",
    cutlery_none: "No Cutlery (Zero Waste)",
    byo_container: "Bring My Own Container / Dabba",
    eco_discount: "Reusable Container Eco-Discount",
    waste_saved: "Waste Saved",
    cutlery_saved: "Cutlery Saved",
    byo_dabbas: "BYO Dabbas",

    // Order statuses
    status_placed: "Order Placed",
    status_accepted: "Accepted",
    status_preparing: "Preparing in Kitchen",
    status_ready: "Ready for Pickup",
    status_picked_up: "Picked Up",
    status_cancelled: "Cancelled",
    status_rejected: "Declined",

    // Flash deals
    flash_deal: "Flash Deal",
    off: "OFF",
    rush_hour: "Peak Demand",
  },
};

const LanguageContext = createContext({
  language: "en",
  t: (key) => key,
});

/**
 * English-only label lookup.
 *
 * The app previously shipped an English/Hindi switch in the student top bar
 * and on the profile screen. Both controls have been removed, so this is no
 * longer a language *selector* -- it is just the label table that `t()` reads
 * from, kept so the existing `t("home")` call sites keep working.
 *
 * There is deliberately no persisted language state. Earlier versions stored
 * `app_language` in localStorage, which meant anyone who had already picked
 * Hindi would have been stranded in it once the switch was taken away. The
 * stale key is cleared on load so that cannot happen.
 */
export function LanguageProvider({ children }) {
  useEffect(() => {
    try {
      localStorage.removeItem("app_language");
    } catch {
      /* storage unavailable (private mode / SSR) -- nothing to clean up */
    }
  }, []);

  const t = (key) => translations.en?.[key] || key;

  return <LanguageContext.Provider value={{ language: "en", t }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
