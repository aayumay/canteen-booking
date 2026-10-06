import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { studentApi } from "../api/studentApi.js";
import { scheduleApi } from "../api/scheduleApi.js";
import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import StaleStrip from "../components/common/StaleStrip.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import StarRating from "../components/common/StarRating.jsx";
import MenuItemCard from "../components/student/MenuItemCard.jsx";
import ItemDetailModal from "../components/student/ItemDetailModal.jsx";
import NotificationsModal, { useNotificationCount } from "../components/student/NotificationsModal.jsx";
import { useCart } from "../hooks/useCart.jsx";
import { useAuth } from "../hooks/useAuth.js";
import {
  CATEGORIES_WITH_ICONS,
  DISCOVER_PLACES,
  matchesDietaryPreference,
  isVegItem,
} from "../lib/foodImages.js";
import { formatRelativeTime, resolveImageUrl } from "../lib/format.js";
import { playPop } from "../lib/sounds.js";
import DecorativeDoodles from "../components/common/DecorativeDoodles.jsx";

export default function StudentMenu() {
  const { vendorId } = useParams();
  const { user } = useAuth();
  const cart = useCart();

  const [dietaryPref, setDietaryPref] = useState(() => localStorage.getItem("user_dietary_pref") || "all");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeItemDetail, setActiveItemDetail] = useState(null);
  const [activeTab, setActiveTab] = useState("menu"); // "menu" | "reviews"
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notificationCount = useNotificationCount();

  // Sync dietary preference if updated elsewhere (e.g. Profile)
  useEffect(() => {
    const handleStorage = () => {
      const saved = localStorage.getItem("user_dietary_pref") || "all";
      setDietaryPref(saved);
    };
    window.addEventListener("focus", handleStorage);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("focus", handleStorage);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Fetch vendors and menu
  const vendorsQuery = useQuery({
    queryKey: ["vendors"],
    queryFn: studentApi.listOpenVendors,
  });
  const vendors = vendorsQuery.data ?? [];
  const activeVendorId = vendorId ? Number(vendorId) : vendors[0]?.id;
  const currentVendor = vendors.find((v) => v.id === activeVendorId) ?? vendors[0];

  const menuQuery = useQuery({
    queryKey: ["vendorMenu", activeVendorId],
    queryFn: () => (activeVendorId ? studentApi.getVendorMenu(activeVendorId) : Promise.resolve([])),
    enabled: Boolean(activeVendorId),
  });

  const reviewsQuery = useQuery({
    queryKey: ["vendorReviews", activeVendorId],
    queryFn: () => (activeVendorId ? studentApi.fetchVendorReviews(activeVendorId) : Promise.resolve({ items: [], average_rating: null, review_count: 0 })),
    enabled: Boolean(activeVendorId),
  });

  const breakQuery = useQuery({
    queryKey: ["upcomingBreak"],
    queryFn: scheduleApi.getUpcomingBreak,
    refetchInterval: 60000,
  });

  const breakData = breakQuery.data;

  const rawItems = menuQuery.data ?? [];
  const reviewsData = reviewsQuery.data ?? { items: [], average_rating: null, review_count: 0 };

  // Filter items by category, search, and active dietary preference
  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      // Must be available if availability flag exists
      if (item.is_available === false) return false;

      // Dietary preference filter
      const matchDiet = matchesDietaryPreference(item, dietaryPref);

      // Category filter
      const matchCat =
        selectedCategory === "All" ||
        item.category?.trim().toLowerCase() === selectedCategory.toLowerCase() ||
        (selectedCategory === "Salads" && /salad|green|soup|veg|pumpkin/i.test(item.name)) ||
        (selectedCategory === "Sushi" && /sushi|roll|fish|salmon/i.test(item.name)) ||
        (selectedCategory === "Pizza" && /pizza|pasta|bread/i.test(item.name)) ||
        (selectedCategory === "Cakes" && /cake|dessert|sweet|ice cream/i.test(item.name)) ||
        (selectedCategory === "Drinks" && /smoothie|shake|drink|tea|coffee|chai|juice/i.test(item.name)) ||
        (selectedCategory === "Bowls" && /bowl|rice|thali|curry/i.test(item.name));

      // Search query filter
      const matchSearch =
        !searchQuery.trim() ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchDiet && matchCat && matchSearch;
    });
  }, [rawItems, dietaryPref, selectedCategory, searchQuery]);

  if (vendorsQuery.isLoading || (activeVendorId && menuQuery.isLoading)) {
    return (
      <div className="center-row">
        <Spinner size="lg" label="Preparing healthy menu" />
      </div>
    );
  }

  if (vendorsQuery.isError || menuQuery.isError) {
    return (
      <ErrorState
        error={vendorsQuery.error || menuQuery.error}
        onRetry={() => {
          vendorsQuery.refetch();
          menuQuery.refetch();
        }}
      />
    );
  }

  return (
    <motion.div
      className="healthy-discovery-page"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <DecorativeDoodles />

      <StaleStrip
        isStale={vendorsQuery.isRefetchError || menuQuery.isRefetchError}
        onRetry={() => {
          vendorsQuery.refetch();
          menuQuery.refetch();
        }}
        isRefetching={vendorsQuery.isFetching || menuQuery.isFetching}
        label="Menu may be out of date"
      />
      
      {/* Top Bar: Search Icon, Notifications, Profile Avatar */}
      <header className="healthy-top-nav">
        <button
          type="button"
          className="nav-icon-btn"
          onClick={() => {
            playPop();
            setSearchOpen(!searchOpen);
          }}
          aria-label="Search"
        >
          <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        <div className="healthy-top-right">
          <button
            type="button"
            className="nav-icon-btn nav-bell-wrap"
            onClick={() => {
              playPop();
              setNotificationsOpen(true);
            }}
            aria-label="Notifications"
          >
            <svg className="nav-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notificationCount > 0 && (
              <span className="bell-badge mono">{notificationCount}</span>
            )}
          </button>

          <Link to="/student/profile" className="healthy-user-avatar" title="View Profile">
            <span>{(user?.name || "A")[0].toUpperCase()}</span>
          </Link>
        </div>
      </header>

      {/* Search Input Box (Collapsible / Expandable) */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            className="healthy-search-box"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <input
              type="text"
              className="healthy-search-field"
              placeholder="Search dishes, pumpkin soup, salmon..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-healthy"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Title --- More Nutrition editorial style */}
      <motion.div
        className="healthy-hero-head"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="healthy-main-title">
          {user?.name ? ("Hey " + user.name.split(" ")[0] + ",") : "Fresh Canteen"}
          <br />
          <span className="healthy-sub-title">Order Healthy.</span>
        </h1>



        {/* Smart Lecture Break Timing Banner */}
        {breakData && (
          breakData.has_schedule ? (
            <div
              style={{
                margin: "12px 0 14px",
                padding: "10px 14px",
                background: "rgba(245, 240, 232, 0.95)",
                border: "1.5px solid var(--color-forest)",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ color: "var(--color-forest)" }}>
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-forest)" }}>
                  {breakData.suggestion_message}
                </span>
              </div>
              <Link
                to="/student/schedule"
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: "var(--color-forest)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Timetable →
              </Link>
            </div>
          ) : (
            <Link
              to="/student/schedule"
              style={{
                margin: "12px 0 14px",
                padding: "8px 12px",
                background: "rgba(255,255,255,0.7)",
                border: "1px dashed var(--color-forest)",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
                color: "var(--color-forest)",
                fontSize: "0.8rem",
              }}
            >
              <span><strong>Set your timetable</strong> for smart lecture break reminders</span>
              <span style={{ fontWeight: 700 }}>Setup →</span>
            </Link>
          )
        )}

        {currentVendor && (
          <div className="healthy-active-stall-bar">
            <div className="stall-info-col">
              <span className="stall-shop-title bold">{currentVendor.shop_name}</span>
              <div className="stall-rating-meta" style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginTop: "4px" }}>
                {reviewsData.average_rating != null && reviewsData.review_count > 0 ? (
                  <span className="vendor-card-rating-pill">
                    <span className="star-icon">★</span>
                    <strong className="mono">{reviewsData.average_rating.toFixed(1)}</strong>
                    <span className="vendor-review-count muted">({reviewsData.review_count} {reviewsData.review_count === 1 ? 'review' : 'reviews'})</span>
                  </span>
                ) : (
                  <span className="vendor-card-no-rating muted small">No reviews yet</span>
                )}
                {currentVendor.current_queue_depth != null && (
                  <span
                    className="queue-depth-pill mono"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      fontSize: "0.72rem",
                      fontWeight: 500,
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      background: "rgba(182, 203, 165, 0.28)",
                      color: "var(--color-forest)",
                      border: "1px solid rgba(51, 92, 48, 0.22)",
                      letterSpacing: "0.01em",
                      lineHeight: 1.2,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        background: "radial-gradient(circle at 35% 35%, #b6cba5 0%, #768f70 70%, #52674d 100%)",
                        boxShadow: "0 1px 1px rgba(0,0,0,0.12)",
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    {currentVendor.current_queue_depth} in queue (~{currentVendor.estimated_wait_minutes ?? (currentVendor.current_queue_depth === 0 ? 5 : currentVendor.current_queue_depth * 3)}m wait)
                  </span>
                )}
              </div>
            </div>

            {/* Menu vs Reviews Tab Switcher */}
            <div className="stall-tab-switch">
              <button
                type="button"
                className={`stall-tab-btn ${activeTab === "menu" ? "stall-tab-active" : ""}`}
                onClick={() => {
                  playPop();
                  setActiveTab("menu");
                }}
              >
                Menu
              </button>
              <button
                type="button"
                className={`stall-tab-btn ${activeTab === "reviews" ? "stall-tab-active" : ""}`}
                onClick={() => {
                  playPop();
                  setActiveTab("reviews");
                }}
              >
                Reviews {reviewsData.review_count > 0 && `(${reviewsData.review_count})`}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {activeTab === "menu" ? (
        <>
          {/* Dietary Filter Bar — synchronized with student profile preferences */}
          <div className="dietary-filter-bar">
            {[
              { id: "all", label: "All Items" },
              { id: "veg", label: "Vegetarian" },
              { id: "vegan", label: "Vegan" },
              { id: "halal", label: "Halal / Organic" },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                className={`dietary-filter-pill ${dietaryPref === d.id ? "dietary-filter-active" : ""}`}
                onClick={() => {
                  playPop();
                  setDietaryPref(d.id);
                  localStorage.setItem("user_dietary_pref", d.id);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Circular Category Icons Bar Matching Screen 2 */}
          <div className="category-icons-scroll-wrap" role="tablist" aria-label="Food categories">
            <div className="category-icons-row">
              {CATEGORIES_WITH_ICONS.map((cat) => {
                const active = cat.id === selectedCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className="category-icon-item"
                    onClick={() => {
                      playPop();
                      setSelectedCategory(cat.id);
                    }}
                  >
                    <div className={`category-icon-circle ${active ? "category-circle-active" : ""}`}>
                      <img src={cat.image} alt={cat.label} className="category-img" loading="lazy" />
                    </div>
                    <span className={`category-icon-label ${active ? "category-label-active" : ""}`}>
                      {cat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 1: Popular Dishes */}
          <div className="healthy-section">
            <div className="healthy-section-head">
              <div>
                <h2 className="healthy-section-title">Popular Dishes</h2>
                <p className="small muted" style={{ marginTop: "2px" }}>
                  {dietaryPref === "all"
                    ? `Showing all available dishes (${filteredItems.length})`
                    : `Showing ${dietaryPref === "veg" ? "Vegetarian" : dietaryPref === "vegan" ? "Vegan" : "Halal / Organic"} dishes (${filteredItems.length})`}
                </p>
              </div>
              {selectedCategory !== "All" && (
                <button
                  type="button"
                  className="view-all-link"
                  onClick={() => setSelectedCategory("All")}
                >
                  View all →
                </button>
              )}
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState
                title="No dishes found"
                hint={
                  dietaryPref !== "all"
                    ? `No available dishes matched '${dietaryPref}'. Tap 'All Items' above or choose another stall.`
                    : "No dishes currently available in this category. Check back shortly!"
                }
              />
            ) : (
              <motion.div layout className="popular-dishes-grid">
                <AnimatePresence mode="popLayout">
                  {filteredItems.map((item) => (
                    <MenuItemCard
                      key={item.id}
                      item={item}
                      vendor={currentVendor}
                      onOpenDetail={(it) => setActiveItemDetail(it)}
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </>
      ) : (
        /* Section: Customer Reviews Feed */
        <div className="healthy-section">
          <div className="healthy-section-head">
            <h2 className="healthy-section-title">Customer Reviews</h2>
          </div>

          <div className="vendor-reviews-container">
            {/* Vendor Rating Summary Banner */}
            <div className="vendor-reviews-summary-card">
              <div className="summary-rating-big mono bold">
                {reviewsData.average_rating ? reviewsData.average_rating.toFixed(1) : "—"}
              </div>
              <div className="summary-rating-details">
                <StarRating rating={reviewsData.average_rating || 0} readOnly size="md" />
                <span className="muted small">
                  Based on {reviewsData.review_count || 0} verified student {reviewsData.review_count === 1 ? "review" : "reviews"}
                </span>
              </div>
            </div>

            {reviewsData.items.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                hint="Order from this stall, pick up your food, and be the first to leave a review and photo!"
              />
            ) : (
              <div className="reviews-feed-list">
                {reviewsData.items.map((r) => (
                  <div key={r.id} className="review-feed-card">
                    <div className="review-card-head">
                      <div className="reviewer-info">
                        <div className="reviewer-avatar">
                          {r.reviewer_name?.[0]?.toUpperCase() || "S"}
                        </div>
                        <div>
                          <h4 className="reviewer-name">{r.reviewer_name}</h4>
                          <span className="review-time muted small mono">
                            {formatRelativeTime(r.created_at)}
                          </span>
                        </div>
                      </div>
                      <StarRating rating={r.rating} readOnly size="sm" />
                    </div>

                    {r.comment && <p className="review-comment-text">{r.comment}</p>}

                    {r.photo_url && (
                      <div className="review-photo-attachment">
                        <img
                          src={resolveImageUrl(r.photo_url)}
                          alt="Student meal photo"
                          className="review-photo-img"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section 2: Discover New Places (Stalls / Canteens) */}
      <div className="healthy-section">
        <div className="healthy-section-head">
          <h2 className="healthy-section-title">Discover New Places</h2>
        </div>

        <div className="places-scroll-wrap">
          <div className="places-row">
            {vendors.length > 0
              ? vendors.map((v, i) => {
                  const placeIcon = DISCOVER_PLACES[i % DISCOVER_PLACES.length];
                  const isActive = v.id === activeVendorId;
                  return (
                    <Link
                      key={v.id}
                      to={`/student/vendors/${v.id}`}
                      className={`place-stall-item ${isActive ? "place-stall-active" : ""}`}
                      onClick={() => playPop()}
                    >
                      <div className="place-stall-circle">
                        <img src={placeIcon.image} alt={v.shop_name} className="place-stall-img" loading="lazy" />
                      </div>
                      <span className="place-stall-name" title={v.shop_name}>
                        {v.shop_name}
                      </span>
                    </Link>
                  );
                })
              : /* No stalls yet. The stock photography list is only ever a
                   placeholder image for a *real* vendor above — rendering it as
                   the stall list itself put five invented kitchens
                   ("Fish & Wine", "Sea Food Bistro") in front of students as
                   though they existed and could be opened. */
                <EmptyState
                  compact
                  title="No stalls open yet"
                  hint="Vendors appear here as soon as they're approved and start taking orders."
                />}
          </div>
        </div>
      </div>

      {/* Item Detail Modal / Screen 3 */}
      <AnimatePresence>
        {activeItemDetail && (
          <ItemDetailModal
            item={activeItemDetail}
            vendor={currentVendor}
            onClose={() => setActiveItemDetail(null)}
          />
        )}
      </AnimatePresence>

      {/* Notifications & Announcements Modal */}
      <NotificationsModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </motion.div>
  );
}
