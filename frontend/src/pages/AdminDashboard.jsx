import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api/adminApi.js";
import { walletApi } from "../api/walletApi.js";
import { useAuth } from "../hooks/useAuth.js";
import EmptyState from "../components/common/EmptyState.jsx";
import StaleStrip from "../components/common/StaleStrip.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import SettlementAdminPanel from "../components/admin/SettlementAdminPanel.jsx";
import { DoodleBrandMark } from "../components/common/doodles.jsx";
import Mascot from "../components/common/Mascot.jsx";
import { resolveImageUrl } from "../lib/format.js";
import { playPop, playSuccess } from "../lib/sounds.js";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview"); // overview | vendors | pending | orders | wallets | settlements | announcements | users

  // Account provisioning form
  const [newUserRole, setNewUserRole] = useState("student"); // student | vendor | admin
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserShop, setNewUserShop] = useState("");
  const [newUserError, setNewUserError] = useState(null);
  const [newUserSuccess, setNewUserSuccess] = useState(null);
  const [rosterSearch, setRosterSearch] = useState("");

  // Orders filters
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderVendorFilter, setOrderVendorFilter] = useState("");

  // Announcements form
  const [annTitle, setAnnTitle] = useState("");
  const [annMsg, setAnnMsg] = useState("");
  const [annExpiry, setAnnExpiry] = useState("");
  const [annError, setAnnError] = useState(null);

  // Wallet adjustment form
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustSuccessMsg, setAdjustSuccessMsg] = useState(null);
  const [adjustErrorMsg, setAdjustErrorMsg] = useState(null);

  // Queries
  const {
    data: summary,
    isLoading: summaryLoading,
    isRefetchError: summaryStale,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ["adminAnalyticsSummary"],
    queryFn: adminApi.getAnalyticsSummary,
    refetchInterval: 30000,
  });

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["adminVendors"],
    queryFn: adminApi.getVendors,
  });

  const {
    data: pendingVendors = [],
    isLoading: pendingLoading,
    isRefetchError: pendingStale,
    isFetching: pendingFetching,
    refetch: refetchPending,
  } = useQuery({
    queryKey: ["adminPendingVendors"],
    queryFn: adminApi.getPendingVendors,
    refetchInterval: 15000,
  });

  const {
    data: orders = [],
    isLoading: ordersLoading,
    isRefetchError: ordersStale,
    isFetching: ordersFetching,
    refetch: refetchOrders,
  } = useQuery({
    queryKey: ["adminOrders", orderStatusFilter, orderVendorFilter],
    queryFn: () =>
      adminApi.getOrders({
        status: orderStatusFilter || undefined,
        vendor_id: orderVendorFilter ? Number(orderVendorFilter) : undefined,
      }),
    refetchInterval: 15000,
  });

  const { data: announcements = [], isLoading: annLoading } = useQuery({
    queryKey: ["adminAnnouncements"],
    queryFn: adminApi.getAnnouncements,
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ["adminStudents", studentSearch],
    queryFn: () => walletApi.searchStudents(studentSearch),
    enabled: activeTab === "wallets",
  });

  // Student roster for the Users tab. Separate query key from the wallet
  // student picker above: that one is capped and shaped for wallet selection,
  // this one is the account list an admin expects to read.
  const { data: roster = [], isLoading: rosterLoading } = useQuery({
    queryKey: ["adminStudentRoster", rosterSearch],
    queryFn: () => adminApi.getStudents(rosterSearch || undefined),
    enabled: activeTab === "users",
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: adminApi.approveVendor,
    onSuccess: () => {
      playSuccess();
      queryClient.invalidateQueries({ queryKey: ["adminPendingVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminAnalyticsSummary"] });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: adminApi.suspendVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminAnalyticsSummary"] });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: adminApi.reactivateVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminAnalyticsSummary"] });
    },
  });

  const createAnnMutation = useMutation({
    mutationFn: adminApi.createAnnouncement,
    onSuccess: () => {
      setAnnTitle("");
      setAnnMsg("");
      setAnnExpiry("");
      setAnnError(null);
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      queryClient.invalidateQueries({ queryKey: ["activeAnnouncements"] });
    },
    onError: (err) => setAnnError(err.message || "Failed to create announcement"),
  });

  const deleteAnnMutation = useMutation({
    mutationFn: adminApi.deleteAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminAnnouncements"] });
      queryClient.invalidateQueries({ queryKey: ["activeAnnouncements"] });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: walletApi.adjustWallet,
    onSuccess: (data) => {
      playSuccess();
      setAdjustSuccessMsg(`Successfully adjusted balance! New student balance: ₹${data.balance_after.toFixed(2)}`);
      setAdjustErrorMsg(null);
      setAdjustAmount("");
      setAdjustReason("");
      queryClient.invalidateQueries({ queryKey: ["adminStudents"] });
      queryClient.invalidateQueries({ queryKey: ["adminAnalyticsSummary"] });
    },
    onError: (err) => {
      setAdjustErrorMsg(err.message || "Adjustment failed.");
      setAdjustSuccessMsg(null);
    },
  });

  // One mutation for all three roles so the form can switch role without
  // swapping handlers. The endpoint is chosen up front so a stale success
  // message can never be attributed to the wrong role.
  const createUserMutation = useMutation({
    mutationFn: (payload) => {
      if (payload.role === "vendor") return adminApi.createVendor(payload);
      if (payload.role === "admin") return adminApi.createAdmin(payload);
      return adminApi.createStudent(payload);
    },
    onSuccess: (data, variables) => {
      playSuccess();
      const label =
        variables.role === "vendor"
          ? "Vendor"
          : variables.role === "admin"
            ? "Admin"
            : "Student";
      setNewUserSuccess(
        `${label} created: ${data.shop_name || data.name} (${data.phone_number}). They log in with an OTP on the normal login screen.`
      );
      setNewUserError(null);
      setNewUserPhone("");
      setNewUserName("");
      setNewUserShop("");
      queryClient.invalidateQueries({ queryKey: ["adminStudentRoster"] });
      queryClient.invalidateQueries({ queryKey: ["adminVendors"] });
      queryClient.invalidateQueries({ queryKey: ["adminAnalyticsSummary"] });
    },
    onError: (err) => {
      setNewUserError(err.message || "Could not create that account.");
      setNewUserSuccess(null);
    },
  });

  const handleCreateAnnouncement = (e) => {
    e.preventDefault();
    if (!annTitle.trim() || !annMsg.trim()) {
      setAnnError("Title and message are required.");
      return;
    }
    createAnnMutation.mutate({
      title: annTitle.trim(),
      message: annMsg.trim(),
      expires_at: annExpiry ? new Date(annExpiry).toISOString() : null,
    });
  };

  const handleAdjustWallet = (e) => {
    e.preventDefault();
    setAdjustSuccessMsg(null);
    setAdjustErrorMsg(null);
    if (!selectedStudent) {
      setAdjustErrorMsg("Please select a student.");
      return;
    }
    const amt = parseFloat(adjustAmount);
    if (isNaN(amt) || amt === 0) {
      setAdjustErrorMsg("Enter a valid amount (positive to credit, negative to debit).");
      return;
    }
    if (!adjustReason.trim()) {
      setAdjustErrorMsg("Mandatory reason note is required for ledger audit.");
      return;
    }
    adjustMutation.mutate({
      student_id: selectedStudent.id,
      amount: amt,
      reason: adjustReason.trim(),
    });
  };

  const handleCreateUser = (e) => {
    e.preventDefault();
    setNewUserError(null);
    setNewUserSuccess(null);

    const phone = newUserPhone.trim();
    const name = newUserName.trim();
    const shop = newUserShop.trim();

    if (!name) {
      setNewUserError("Name is required.");
      return;
    }
    // The backend only checks length, so a shape check is the only place a
    // typo gets caught before it becomes an account nobody can log into.
    if (!/^\+?[0-9]{5,20}$/.test(phone)) {
      setNewUserError("Enter a valid phone number (5-20 digits, may start with +).");
      return;
    }
    if (newUserRole === "vendor" && !shop) {
      setNewUserError("A vendor needs a shop name.");
      return;
    }

    createUserMutation.mutate(
      newUserRole === "vendor"
        ? { role: "vendor", phone_number: phone, name, shop_name: shop }
        : { role: newUserRole, phone_number: phone, name }
    );
  };

  return (
    <div className="admin-shell">
      {/* Top Navigation */}
      <header className="admin-header">
        <div className="admin-brand">
          {/* The brand mark, not Mascot: the admin header is a brand slot, and
              Mascot is an illustration used for avatars and empty states. Same
              glyph as the landing wordmark and the student appbar. */}
          <DoodleBrandMark size={34} className="admin-brand-mark" />
          <div>
            <div className="admin-badge">INSTITUTION ADMIN</div>
            <h1 className="admin-title">Canteen Booking</h1>
          </div>
        </div>
        <div className="admin-user-nav">
          <span className="admin-name">{user?.name || "Admin"}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Analytics & Overview
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Approvals {pendingVendors.length > 0 && `(${pendingVendors.length})`}
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "vendors" ? "active" : ""}`}
          onClick={() => setActiveTab("vendors")}
        >
          Vendors ({vendors.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          Live Orders ({orders.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "wallets" ? "active" : ""}`}
          onClick={() => setActiveTab("wallets")}
        >
          Student Wallets & Top-up
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "settlements" ? "active" : ""}`}
          onClick={() => setActiveTab("settlements")}
        >
          Settlements
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "announcements" ? "active" : ""}`}
          onClick={() => setActiveTab("announcements")}
        >
          Announcements ({announcements.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === "users" ? "active" : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Accounts
        </button>
      </div>

      <main className="admin-content">
        {/* Metrics, approvals and orders all poll. Surface a failed poll
            instead of letting admin read figures that quietly stopped updating. */}
        <StaleStrip
          isStale={summaryStale || pendingStale || ordersStale}
          onRetry={() => {
            refetchSummary();
            refetchPending();
            refetchOrders();
          }}
          isRefetching={summaryFetching || pendingFetching || ordersFetching}
          label="Dashboard figures may be out of date"
        />
        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div className="admin-section">
            {summaryLoading ? (
              <div className="admin-loader">
                <Spinner size="lg" label="Loading live database metrics" />
              </div>
            ) : summary ? (
              <div className="admin-overview-grid">
                {/* Metrics Cards */}
                <div className="admin-metric-card">
                  <span className="metric-label">Total Completed/Active Orders</span>
                  <div className="metric-value">{summary.total_orders}</div>
                  <span className="metric-sub">Today: {summary.orders_today} | Yesterday: {summary.orders_yesterday}</span>
                </div>

                <div className="admin-metric-card highlight">
                  <span className="metric-label">Total System Revenue</span>
                  <div className="metric-value">₹{summary.total_revenue.toFixed(2)}</div>
                  <span className="metric-sub">Today: ₹{summary.revenue_today.toFixed(2)} | Yesterday: ₹{summary.revenue_yesterday.toFixed(2)}</span>
                </div>

                <div className="admin-metric-card">
                  <span className="metric-label">Active Vendors</span>
                  <div className="metric-value">{summary.active_vendors_count}</div>
                  <span className="metric-sub">Provisioned canteen outlets</span>
                </div>

                <div className="admin-metric-card">
                  <span className="metric-label">Registered Students</span>
                  <div className="metric-value">{summary.active_students_count}</div>
                  <span className="metric-sub">Active campus users</span>
                </div>

                {/* Peak Hours Breakdown */}
                <div className="admin-panel full-width">
                  <h3 className="panel-title">Order Volume by Hour of Day</h3>
                  <div className="hourly-histogram">
                    {summary.peak_hours?.map((item) => {
                      const maxCnt = Math.max(1, ...summary.peak_hours.map((p) => p.order_count));
                      const heightPct = Math.round((item.order_count / maxCnt) * 100);
                      return (
                        <div key={item.hour} className="hour-bar-wrapper" title={`${item.hour}:00 - ${item.order_count} orders`}>
                          <div className="hour-bar" style={{ height: `${Math.max(4, heightPct)}%` }} />
                          <span className="hour-label">{item.hour}h</span>
                          {item.order_count > 0 && <span className="hour-count">{item.order_count}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <p className="muted">No analytics available.</p>
            )}
          </div>
        )}

        {/* PENDING APPROVALS TAB */}
        {activeTab === "pending" && (
          <div className="admin-section">
            <div className="section-header">
              <h2 className="section-heading">Pending Vendor Registrations</h2>
              <p className="section-sub">Review self-registered canteen partners and approve them for campus food ordering.</p>
            </div>

            {pendingLoading ? (
              <Spinner size="md" />
            ) : pendingVendors.length === 0 ? (
              <EmptyState
                compact
                mascot={false}
                title="No pending applications"
                hint="Every stall that has applied has been reviewed. New ones will land here."
              />
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Stall Photo</th>
                      <th>Shop / Canteen Name</th>
                      <th>Owner / Manager</th>
                      <th>Phone</th>
                      <th>Approval Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVendors.map((v) => (
                      <tr key={v.id}>
                        <td className="mono">#{v.id}</td>
                        <td>
                          {v.stall_photo_url ? (
                            <img
                              src={resolveImageUrl(v.stall_photo_url)}
                              alt={v.shop_name}
                              className="admin-stall-thumb"
                            />
                          ) : (
                            <div className="admin-stall-thumb" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-sage)" }}>
                              <Mascot size={22} variant="default" />
                            </div>
                          )}
                        </td>
                        <td>
                          <strong>{v.shop_name}</strong>
                        </td>
                        <td>{v.name || "—"}</td>
                        <td className="mono">{v.phone_number}</td>
                        <td>
                          <span className="status-pill pill-pending-approval">
                            Pending Admin Approval
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-success-sm"
                            disabled={approveMutation.isPending}
                            onClick={() => {
                              if (window.confirm(`Approve vendor "${v.shop_name}" to go live?`)) {
                                approveMutation.mutate(v.id);
                              }
                            }}
                          >
                            Approve Stall
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VENDORS TAB */}
        {activeTab === "vendors" && (
          <div className="admin-section">
            <div className="section-header">
              <h2 className="section-heading">Canteen Vendors & Outlets</h2>
              <p className="section-sub">Suspend or reactivate vendor stores across the institution.</p>
            </div>

            {vendorsLoading ? (
              <Spinner size="md" />
            ) : vendors.length === 0 ? (
              <EmptyState
                compact
                mascot={false}
                title="No vendors yet"
                hint="Approved stalls will appear here once they are provisioned."
              />
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Shop / Name</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Kitchen Open</th>
                      <th>Dishes</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Rating</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors.map((v) => (
                      <tr key={v.id} className={!v.is_active ? "row-suspended" : ""}>
                        <td className="mono">#{v.id}</td>
                        <td>
                          <strong>{v.shop_name}</strong>
                          <div className="muted small">{v.name}</div>
                        </td>
                        <td className="mono">{v.phone_number}</td>
                        <td>
                          <span className={`status-pill ${v.is_active ? "pill-active" : "pill-suspended"}`}>
                            {v.is_active ? "Active" : "Suspended"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${v.is_shop_open ? "pill-open" : "pill-closed"}`}>
                            {v.is_shop_open ? "Open" : "Closed"}
                          </span>
                        </td>
                        <td>{v.item_count}</td>
                        <td>{v.total_order_count}</td>
                        <td className="mono">₹{v.total_revenue.toFixed(2)}</td>
                        <td>{v.average_rating ? `${v.average_rating} (${v.review_count})` : "—"}</td>
                        <td>
                          {v.is_active ? (
                            <button
                              type="button"
                              className="btn btn-danger-sm"
                              disabled={suspendMutation.isPending}
                              onClick={() => {
                                if (window.confirm(`Suspend vendor "${v.shop_name}"? Their menu will be hidden.`)) {
                                  suspendMutation.mutate(v.id);
                                }
                              }}
                            >
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-success-sm"
                              disabled={reactivateMutation.isPending}
                              onClick={() => reactivateMutation.mutate(v.id)}
                            >
                              Reactivate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div className="admin-section">
            <div className="section-header">
              <h2 className="section-heading">Platform-Wide Live Orders</h2>
              <div className="order-filters">
                <select
                  className="filter-select"
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="placed">Placed</option>
                  <option value="accepted">Accepted</option>
                  <option value="preparing">Preparing</option>
                  <option value="ready">Ready</option>
                  <option value="picked_up">Picked Up</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="rejected">Rejected</option>
                </select>

                <select
                  className="filter-select"
                  value={orderVendorFilter}
                  onChange={(e) => setOrderVendorFilter(e.target.value)}
                >
                  <option value="">All Vendors</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.shop_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {ordersLoading ? (
              <Spinner size="md" />
            ) : orders.length === 0 ? (
              <EmptyState
                compact
                mascot={false}
                title="No matching orders"
                hint="Nothing here fits the current filters. Try widening them."
              />
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Token</th>
                      <th>Vendor</th>
                      <th>Items</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Status</th>
                      <th>Placed Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td className="mono">#{o.id}</td>
                        <td className="mono bold">{o.pickup_token}</td>
                        <td>Vendor #{o.vendor_id}</td>
                        <td>
                          {o.items?.map((item) => (
                            <div key={item.id} className="order-item-line">
                              {item.quantity}x {item.item_name}
                            </div>
                          ))}
                        </td>
                        <td className="mono bold">₹{Number(o.total_amount).toFixed(2)}</td>
                        <td>
                          <span className="small mono">{o.payment_method || "counter"}</span>
                        </td>
                        <td>
                          <span className={`status-pill pill-${o.status}`}>{o.status}</span>
                        </td>
                        <td className="small muted">
                          {new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* WALLETS & TOP-UP TAB */}
        {activeTab === "wallets" && (
          <div className="admin-section">
            <div className="admin-grid-2col">
              {/* Student Lookup List */}
              <div className="admin-panel">
                <h3 className="panel-title">Student Accounts Lookup</h3>
                <div className="search-bar" style={{ marginBottom: "12px" }}>
                  <input
                    type="text"
                    className="input input-sm"
                    placeholder="Search by name or phone..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                </div>

                {studentsLoading ? (
                  <Spinner size="md" />
                ) : students.length === 0 ? (
                  <EmptyState
                compact
                mascot={false}
                title="No students found"
                hint={studentSearch ? "No one matches that search." : "Start typing to find a student."}
              />
                ) : (
                  <div className="admin-student-list">
                    {students.map((st) => (
                      <div
                        key={st.id}
                        className={`admin-student-item ${selectedStudent?.id === st.id ? "selected" : ""}`}
                        onClick={() => {
                          playPop();
                          setSelectedStudent(st);
                          setAdjustSuccessMsg(null);
                          setAdjustErrorMsg(null);
                        }}
                      >
                        <div>
                          <strong>{st.name || "Student"}</strong>
                          <div className="mono small muted">{st.phone_number}</div>
                        </div>
                        <span className="linklike small">Select →</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Adjustment Form */}
              <div className="admin-panel">
                <h3 className="panel-title">Internal Ledger Adjustment (Deposit / Debit)</h3>
                {selectedStudent ? (
                  <form onSubmit={handleAdjustWallet} className="admin-form">
                    <div className="selected-student-pill">
                      <span>Selected Student:</span>
                      <strong>{selectedStudent.name} ({selectedStudent.phone_number})</strong>
                    </div>

                    <label className="field">
                      <span className="field-label">Adjustment Amount (₹)</span>
                      <input
                        type="number"
                        step="0.50"
                        className="input mono"
                        placeholder="e.g. 500 for deposit, -100 for deduction"
                        value={adjustAmount}
                        onChange={(e) => setAdjustAmount(e.target.value)}
                        required
                      />
                      <span className="field-hint">Use positive for deposit/topup, negative for deduction.</span>
                    </label>

                    <label className="field">
                      <span className="field-label">Mandatory Audit Reason</span>
                      <input
                        type="text"
                        className="input"
                        placeholder="e.g. Cash deposit at accounts office / Scholarship credit"
                        value={adjustReason}
                        onChange={(e) => setAdjustReason(e.target.value)}
                        required
                      />
                    </label>

                    {adjustSuccessMsg && <div className="form-success">{adjustSuccessMsg}</div>}
                    {adjustErrorMsg && <div className="form-error">{adjustErrorMsg}</div>}

                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      disabled={adjustMutation.isPending}
                    >
                      {adjustMutation.isPending ? <Spinner size="sm" /> : "Post Ledger Adjustment"}
                    </button>
                  </form>
                ) : (
                  <p className="muted">Select a student from the list on the left to top up or adjust balance.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SETTLEMENTS TAB */}
        {activeTab === "settlements" && (
          <div className="admin-section">
            <SettlementAdminPanel />
          </div>
        )}

        {/* ANNOUNCEMENTS TAB */}
        {activeTab === "announcements" && (
          <div className="admin-section">
            <div className="admin-grid-2col">
              {/* Form */}
              <div className="admin-panel">
                <h3 className="panel-title">Publish Campus Announcement</h3>
                <form onSubmit={handleCreateAnnouncement} className="admin-form">
                  <label className="field">
                    <span className="field-label">Announcement Title</span>
                    <input
                      className="input"
                      placeholder="e.g. Canteen Closure Notice"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Message Body</span>
                    <textarea
                      className="input input-textarea"
                      rows={4}
                      placeholder="e.g. Central cafeteria will close at 4 PM for pest control."
                      value={annMsg}
                      onChange={(e) => setAnnMsg(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Expiration Date & Time (Optional)</span>
                    <input
                      className="input"
                      type="datetime-local"
                      value={annExpiry}
                      onChange={(e) => setAnnExpiry(e.target.value)}
                    />
                  </label>

                  {annError && <div className="form-error">{annError}</div>}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createAnnMutation.isPending}
                  >
                    {createAnnMutation.isPending ? <Spinner size="sm" /> : "Publish Announcement"}
                  </button>
                </form>
              </div>

              {/* List */}
              <div className="admin-panel">
                <h3 className="panel-title">Active & Past Announcements</h3>
                {annLoading ? (
                  <Spinner size="md" />
                ) : announcements.length === 0 ? (
                  <EmptyState
                compact
                mascot={false}
                title="No announcements yet"
                hint="Post one and it'll appear on every student's menu."
              />
                ) : (
                  <div className="announcement-manage-list">
                    {announcements.map((a) => (
                      <div key={a.id} className="announcement-manage-card">
                        <div className="ann-manage-header">
                          <strong className="ann-manage-title">{a.title}</strong>
                          <button
                            type="button"
                            className="btn btn-danger-sm"
                            onClick={() => {
                              if (window.confirm("Delete this announcement?")) {
                                deleteAnnMutation.mutate(a.id);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                        <p className="ann-manage-body">{a.message}</p>
                        <div className="ann-manage-meta">
                          <span>Created: {new Date(a.created_at).toLocaleDateString()}</span>
                          {a.expires_at && (
                            <span>Expires: {new Date(a.expires_at).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ACCOUNTS TAB */}
        {activeTab === "users" && (
          <div className="admin-section">
            <div className="section-header">
              <h2 className="section-heading">Create &amp; Review Accounts</h2>
              <p className="section-sub">
                Provision a student, vendor or admin account. New accounts have no
                password — their owner signs in by requesting an OTP on the usual
                login screen.
              </p>
            </div>

            <div className="admin-grid-2col">
              <div className="admin-panel">
                <h3 className="panel-title">Create Account</h3>
                <form onSubmit={handleCreateUser} className="admin-form">
                  <label className="field">
                    <span className="field-label">Account Type</span>
                    <select
                      className="input"
                      value={newUserRole}
                      onChange={(e) => {
                        setNewUserRole(e.target.value);
                        setNewUserError(null);
                        setNewUserSuccess(null);
                      }}
                    >
                      <option value="student">Student</option>
                      <option value="vendor">Vendor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>

                  <label className="field">
                    <span className="field-label">Phone Number</span>
                    <input
                      className="input"
                      type="tel"
                      placeholder="e.g. +919876543210"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      required
                    />
                  </label>

                  <label className="field">
                    <span className="field-label">Full Name</span>
                    <input
                      className="input"
                      placeholder="e.g. Aayush Kushwaha"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      required
                    />
                  </label>

                  {newUserRole === "vendor" && (
                    <label className="field">
                      <span className="field-label">Shop Name</span>
                      <input
                        className="input"
                        placeholder="e.g. Campus Pizza"
                        value={newUserShop}
                        onChange={(e) => setNewUserShop(e.target.value)}
                        required
                      />
                    </label>
                  )}

                  {newUserRole === "admin" && (
                    <p className="muted small">
                      Admins can provision accounts and manage vendors, orders,
                      wallets and settlements. Only create one you trust with the
                      institution.
                    </p>
                  )}

                  {newUserError && <div className="form-error">{newUserError}</div>}
                  {newUserSuccess && (
                    <div className="form-success">{newUserSuccess}</div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={createUserMutation.isPending}
                  >
                    {createUserMutation.isPending ? (
                      <Spinner size="sm" />
                    ) : (
                      `Create ${
                        newUserRole === "vendor"
                          ? "Vendor"
                          : newUserRole === "admin"
                            ? "Admin"
                            : "Student"
                      }`
                    )}
                  </button>
                </form>
              </div>

              <div className="admin-panel">
                <h3 className="panel-title">Student Roster</h3>
                <input
                  className="input"
                  placeholder="Search by name or phone"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                />

                {rosterLoading ? (
                  <Spinner size="md" />
                ) : roster.length === 0 ? (
                  <EmptyState
                    compact
                    mascot={false}
                    title="No students found"
                    hint={
                      rosterSearch
                        ? "No student matches that search."
                        : "Create a student account to add someone to the roster."
                    }
                  />
                ) : (
                  <div className="admin-table-wrapper">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Phone</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((s) => (
                          <tr key={s.id}>
                            <td className="mono">#{s.id}</td>
                            <td>{s.name || "—"}</td>
                            <td className="mono">{s.phone_number}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
