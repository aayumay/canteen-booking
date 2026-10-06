import axiosClient from "./axiosClient.js";

/** PATCH /vendor/shop/toggle → {is_shop_open} */
export async function toggleShop() {
  const { data } = await axiosClient.patch("/vendor/shop/toggle");
  return data;
}

/** PATCH /vendor/profile → UserOut */
export async function updateProfile({ name, shop_name, stall_photo_url }) {
  const { data } = await axiosClient.patch("/vendor/profile", {
    ...(name !== undefined ? { name } : {}),
    ...(shop_name !== undefined ? { shop_name } : {}),
    ...(stall_photo_url !== undefined ? { stall_photo_url } : {}),
  });
  return data;
}

/** GET /vendor/menu → [MenuItemOut] (all items, including unavailable) */
export async function listMyMenu() {
  const { data } = await axiosClient.get("/vendor/menu");
  return data;
}

/** POST /vendor/menu → 201 MenuItemOut */
export async function addMenuItem(payload) {
  const { data } = await axiosClient.post("/vendor/menu", payload);
  return data;
}

/** PATCH /vendor/menu/{itemId} → MenuItemOut (partial update) */
export async function updateMenuItem(itemId, payload) {
  const { data } = await axiosClient.patch(`/vendor/menu/${itemId}`, payload);
  return data;
}

/** DELETE /vendor/menu/{itemId} → 204 */
export async function deleteMenuItem(itemId) {
  await axiosClient.delete(`/vendor/menu/${itemId}`);
  return true;
}

/** GET /vendor/orders → [OrderOut] */
export async function listIncomingOrders() {
  const { data } = await axiosClient.get("/vendor/orders");
  return data;
}

/** GET /vendor/orders/{orderId} → OrderWithItemsOut */
export async function getIncomingOrder(orderId) {
  const { data } = await axiosClient.get(`/vendor/orders/${orderId}`);
  return data;
}

/**
 * PATCH /vendor/orders/{orderId}/status — {status, rejection_reason?}.
 * The server validates the transition against its state machine; rejection
 * requires a non-empty reason.
 */
export async function updateOrderStatus(orderId, { status, rejection_reason }) {
  const { data } = await axiosClient.patch(`/vendor/orders/${orderId}/status`, {
    status,
    ...(rejection_reason ? { rejection_reason } : {}),
  });
  return data; // OrderWithItemsOut
}

/** GET /vendor/reviews → ReviewListOut */
export async function fetchOwnReviews({ limit = 50, offset = 0 } = {}) {
  const { data } = await axiosClient.get("/vendor/reviews", {
    params: { limit, offset },
  });
  return data;
}

/** POST /vendor/slots → PickupSlotOut */
export async function createSlot({ start_time, end_time, max_orders }) {
  const { data } = await axiosClient.post("/vendor/slots", {
    start_time,
    end_time,
    max_orders,
  });
  return data;
}

/** GET /vendor/slots → [PickupSlotOut] */
export async function listSlots() {
  const { data } = await axiosClient.get("/vendor/slots");
  return data;
}

/** DELETE /vendor/slots/{slotId} → 204 */
export async function deleteSlot(slotId) {
  await axiosClient.delete(`/vendor/slots/${slotId}`);
  return true;
}

/** PATCH /vendor/menu/{itemId}/flash-discount → MenuItemOut */
export async function setFlashDiscount(itemId, { is_flash_discount, flash_discount_percent }) {
  const { data } = await axiosClient.patch(`/vendor/menu/${itemId}/flash-discount`, {
    is_flash_discount,
    flash_discount_percent,
  });
  return data;
}

/** GET /vendor/analytics/demand-by-hour → [HourlyStat] */
export async function getDemandByHour() {
  const { data } = await axiosClient.get("/vendor/analytics/demand-by-hour");
  return data;
}

/**
 * GET /vendor/orders/ready → [ReadyOrderOut]
 * Pickup codes are masked to their last 4 digits in this payload.
 */
export async function listReadyOrders() {
  const { data } = await axiosClient.get("/vendor/orders/ready");
  return data;
}

/**
 * POST /vendor/orders/verify-pickup → PickupVerifyOut
 * @param {{order_id?: number, pickup_token?: string}} payload
 *   Send the scanned QR as both fields, a hand-typed code on its own, or an
 *   order_id alone when confirming straight from the ready-orders list.
 */
export async function verifyPickup({ order_id, pickup_token } = {}) {
  const { data } = await axiosClient.post("/vendor/orders/verify-pickup", {
    ...(order_id !== undefined && order_id !== null ? { order_id } : {}),
    ...(pickup_token !== undefined && pickup_token !== null ? { pickup_token } : {}),
  });
  return data;
}

/**
 * GET /vendor/settlements/summary → VendorSettlementSummaryOut
 * Lifetime totals for the signed-in vendor only. No vendor_id is ever sent:
 * the server derives it from the auth token, so one vendor cannot read
 * another's ledger.
 */
export async function getSettlementSummary() {
  const { data } = await axiosClient.get("/vendor/settlements/summary");
  return data;
}

/**
 * GET /vendor/settlements → {items, total, limit, offset}
 * @param {{status?: "pending"|"settled"|"voided", limit?: number, offset?: number}} params
 */
export async function listSettlements(params = {}) {
  const { data } = await axiosClient.get("/vendor/settlements", { params });
  return data;
}

export const vendorApi = {
  toggleShop,
  updateProfile,
  listMyMenu,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listIncomingOrders,
  getIncomingOrder,
  updateOrderStatus,
  listReadyOrders,
  verifyPickup,
  fetchOwnReviews,
  createSlot,
  listSlots,
  deleteSlot,
  setFlashDiscount,
  getDemandByHour,
  getSettlementSummary,
  listSettlements,
};

