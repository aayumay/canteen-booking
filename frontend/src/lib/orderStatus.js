/**
 * Single source of truth for order status metadata, mirroring the backend's
 * OrderStatus enum and seeded transition table.
 */

export const ORDER_STATUSES = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "rejected",
  "cancelled",
];

export const TERMINAL_STATUSES = ["picked_up", "rejected", "cancelled"];

export const STATUS_LABELS = {
  placed: "Placed",
  accepted: "Accepted",
  preparing: "Preparing",
  ready: "Ready",
  picked_up: "Picked up",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

// Semantic palette: lime = ready/picked_up, orange = placed/accepted/preparing, danger = rejected/cancelled
export const STATUS_TONE = {
  placed: "orange",
  accepted: "orange",
  preparing: "orange",
  ready: "lime",
  picked_up: "lime",
  rejected: "danger",
  cancelled: "danger",
};

/** Legal vendor transitions (display guidance only — the server enforces the truth). */
export const VENDOR_NEXT_ACTIONS = {
  placed: ["accepted", "rejected"],
  accepted: ["preparing"],
  preparing: ["ready"],
  ready: ["picked_up"],
};

/** Legal student transitions. */
export const STUDENT_NEXT_ACTIONS = {
  placed: ["cancelled"],
};

export const VENDOR_ACTION_LABELS = {
  accepted: "Accept",
  preparing: "Start preparing",
  ready: "Mark ready",
  picked_up: "Complete pickup",
};

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}
