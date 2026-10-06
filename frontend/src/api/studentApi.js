import axiosClient from "./axiosClient.js";

/** GET /student/vendors → [VendorOut] (open vendors only) */
export async function listOpenVendors() {
  const { data } = await axiosClient.get("/student/vendors");
  return data;
}

/** GET /student/vendors/{vendorId}/menu → [MenuItemOut] (available only) */
export async function getVendorMenu(vendorId) {
  const { data } = await axiosClient.get(`/student/vendors/${vendorId}/menu`);
  return data;
}

/**
 * POST /student/orders — the server computes the total from live menu prices.
 * We deliberately send only vendor_id + {menu_item_id, quantity} pairs; client-side
 * price math is display-only and is never sent.
 */
export async function placeOrder({ vendor_id, items, payment_method, pickup_slot_id, cutlery_needed, reusable_container, notes }) {
  const { data } = await axiosClient.post("/student/orders", {
    vendor_id,
    items,
    payment_method,
    pickup_slot_id,
    cutlery_needed,
    reusable_container,
    notes,
  });
  return data; // OrderWithItemsOut
}

/** GET /student/orders → [OrderOut] */
export async function listMyOrders() {
  const { data } = await axiosClient.get("/student/orders");
  return data;
}

/** GET /student/orders/{orderId} → OrderWithItemsOut */
export async function getMyOrder(orderId) {
  const { data } = await axiosClient.get(`/student/orders/${orderId}`);
  return data;
}

/** PATCH /student/orders/{orderId}/cancel → OrderWithItemsOut */
export async function cancelOrder(orderId) {
  const { data } = await axiosClient.patch(`/student/orders/${orderId}/cancel`);
  return data;
}

/** POST /student/orders/{orderId}/review → ReviewOut */
export async function submitReview(orderId, { rating, comment, photo_url }) {
  const { data } = await axiosClient.post(`/student/orders/${orderId}/review`, {
    rating,
    comment,
    photo_url,
  });
  return data;
}

/** GET /student/vendors/{vendorId}/reviews → ReviewListOut */
export async function fetchVendorReviews(vendorId, { limit = 50, offset = 0 } = {}) {
  const { data } = await axiosClient.get(`/student/vendors/${vendorId}/reviews`, {
    params: { limit, offset },
  });
  return data;
}

/** GET /student/vendors/{vendorId}/slots → [PickupSlotOut] */
export async function getVendorSlots(vendorId) {
  const { data } = await axiosClient.get(`/student/vendors/${vendorId}/slots`);
  return data;
}

/** GET /student/sustainability-stats → SustainabilityStatsOut */
export async function getSustainabilityStats() {
  const { data } = await axiosClient.get("/student/sustainability-stats");
  return data;
}

export const studentApi = {
  listOpenVendors,
  getVendorMenu,
  getVendorSlots,
  placeOrder,
  listMyOrders,
  getMyOrder,
  cancelOrder,
  submitReview,
  fetchVendorReviews,
  getSustainabilityStats,
};

