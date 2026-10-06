import axiosClient from "./axiosClient.js";

export const adminApi = {
  getVendors: async () => {
    const { data } = await axiosClient.get("/admin/vendors");
    return data;
  },
  getPendingVendors: async () => {
    const { data } = await axiosClient.get("/admin/vendors/pending");
    return data;
  },
  approveVendor: async (vendorId) => {
    const { data } = await axiosClient.patch(`/admin/vendors/${vendorId}/approve`);
    return data;
  },
  suspendVendor: async (vendorId) => {
    const { data } = await axiosClient.patch(`/admin/vendors/${vendorId}/suspend`);
    return data;
  },
  reactivateVendor: async (vendorId) => {
    const { data } = await axiosClient.patch(`/admin/vendors/${vendorId}/reactivate`);
    return data;
  },
  getOrders: async (params = {}) => {
    const { data } = await axiosClient.get("/admin/orders", { params });
    return data;
  },

  // -------------------------------------------------------------------------
  // Account provisioning.
  //
  // These authenticate with the admin's own JWT. The backend also accepts the
  // X-Admin-Key bootstrap secret on the same routes, but that key must never
  // be shipped to the browser, so the dashboard never sends it.
  //
  // A provisioned account has no password: its owner logs in by requesting an
  // OTP on the usual login screen. Creating a user here does not log them in
  // and does not bypass that step.
  // -------------------------------------------------------------------------

  /** POST /admin/students → UserOut */
  createStudent: async ({ phone_number, name }) => {
    const { data } = await axiosClient.post("/admin/students", {
      phone_number,
      name,
    });
    return data;
  },

  /** POST /admin/vendors → VendorOut */
  createVendor: async ({ phone_number, name, shop_name }) => {
    const { data } = await axiosClient.post("/admin/vendors", {
      phone_number,
      name,
      shop_name,
    });
    return data;
  },

  /** POST /admin/users → UserOut */
  createAdmin: async ({ phone_number, name }) => {
    const { data } = await axiosClient.post("/admin/users", {
      phone_number,
      name,
    });
    return data;
  },

  /** GET /admin/students → UserOut[] */
  getStudents: async (search = "") => {
    const { data } = await axiosClient.get("/admin/students", {
      params: search ? { search } : undefined,
    });
    return data;
  },
  getAnalyticsSummary: async () => {
    const { data } = await axiosClient.get("/admin/analytics/summary");
    return data;
  },
  getAnnouncements: async () => {
    const { data } = await axiosClient.get("/admin/announcements");
    return data;
  },
  createAnnouncement: async ({ title, message, expires_at }) => {
    const { data } = await axiosClient.post("/admin/announcements", {
      title,
      message,
      expires_at: expires_at || null,
    });
    return data;
  },
  deleteAnnouncement: async (id) => {
    await axiosClient.delete(`/admin/announcements/${id}`);
    return true;
  },

  // -------------------------------------------------------------------------
  // Vendor settlement ledger.
  //
  // These record that money already moved outside the app (bank transfer or
  // cash handover). Nothing here initiates a payment, which is why the UI
  // says "Mark as Settled" and "Record Payment" rather than "Pay now".
  // -------------------------------------------------------------------------

  /** GET /admin/settlements/summary → AdminSettlementSummaryOut */
  getSettlementSummary: async () => {
    const { data } = await axiosClient.get("/admin/settlements/summary");
    return data;
  },

  /** GET /admin/settlements/vendors → [AdminVendorBalanceOut] */
  getSettlementVendorBalances: async () => {
    const { data } = await axiosClient.get("/admin/settlements/vendors");
    return data;
  },

  /**
   * GET /admin/settlements → {items, total, limit, offset}
   * @param {{vendor_id?: number, status?: "pending"|"settled"|"voided", limit?: number, offset?: number}} params
   */
  listSettlements: async (params = {}) => {
    const { data } = await axiosClient.get("/admin/settlements", { params });
    return data;
  },

  /** PATCH /admin/settlements/{id}/mark-settled → VendorSettlementDetailOut */
  markSettlementSettled: async (settlementId) => {
    const { data } = await axiosClient.patch(
      `/admin/settlements/${settlementId}/mark-settled`
    );
    return data;
  },

  /** POST /admin/settlements/bulk-settle → [VendorSettlementDetailOut] */
  bulkSettleVendor: async (vendorId) => {
    const { data } = await axiosClient.post("/admin/settlements/bulk-settle", {
      vendor_id: vendorId,
    });
    return data;
  },
};
