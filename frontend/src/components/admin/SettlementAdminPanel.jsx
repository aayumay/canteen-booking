import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/adminApi.js";
import Modal from "../common/Modal.jsx";
import EmptyState from "../common/EmptyState.jsx";
import ErrorState from "../common/ErrorState.jsx";
import { Spinner } from "../common/Spinner.jsx";
import { formatMoney } from "../../lib/format.js";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Awaiting payment" },
  { id: "settled", label: "Settled" },
  { id: "voided", label: "Cancelled" },
];

const STATUS_COPY = {
  pending: "Awaiting payment",
  settled: "Settled",
  voided: "Cancelled",
};

const PAGE_SIZE = 25;

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errorMessage(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail) && detail?.[0]?.msg) return String(detail[0].msg);
  return fallback;
}

/**
 * Admin view of the money the platform owes vendors.
 *
 * "Mark as Settled" records a payment that has already happened outside the
 * app. Nothing on this screen transfers money, so the wording avoids anything
 * that sounds like a payout button, and the bulk action asks for confirmation
 * because it stamps a whole vendor's balance as one payment.
 */
export default function SettlementAdminPanel() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [vendorFilter, setVendorFilter] = useState("");
  const [page, setPage] = useState(0);

  // Which action is waiting on confirmation. Kept as one value rather than two
  // booleans so the modal can never be open for both at once.
  const [confirm, setConfirm] = useState(null); // {type:'single'|'bulk', ...}

  const summaryQuery = useQuery({
    queryKey: ["adminSettlementSummary"],
    queryFn: () => adminApi.getSettlementSummary(),
  });

  const balancesQuery = useQuery({
    queryKey: ["adminSettlementVendorBalances"],
    queryFn: () => adminApi.getSettlementVendorBalances(),
  });

  const listQuery = useQuery({
    queryKey: ["adminSettlements", statusFilter, vendorFilter, page],
    queryFn: () =>
      adminApi.listSettlements({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        ...(vendorFilter ? { vendor_id: Number(vendorFilter) } : {}),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["adminSettlementSummary"] });
    queryClient.invalidateQueries({ queryKey: ["adminSettlementVendorBalances"] });
    queryClient.invalidateQueries({ queryKey: ["adminSettlements"] });
  };

  const markSettledMutation = useMutation({
    mutationFn: (id) => adminApi.markSettlementSettled(id),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
    },
  });

  const bulkSettleMutation = useMutation({
    mutationFn: (vendorId) => adminApi.bulkSettleVendor(vendorId),
    onSuccess: () => {
      invalidate();
      setConfirm(null);
    },
  });

  const summary = summaryQuery.data;
  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const balances = balancesQuery.data ?? [];
  const pendingBalances = balances.filter((b) => b.pending_count > 0);

  if (summaryQuery.isLoading) {
    return (
      <div className="center-row">
        <Spinner size="lg" label="Loading settlement obligations" />
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
    );
  }

  const singleError =
    markSettledMutation.error &&
    errorMessage(markSettledMutation.error, "Could not record that payment.");
  const bulkError =
    bulkSettleMutation.error &&
    errorMessage(bulkSettleMutation.error, "Could not settle that vendor's balance.");

  return (
    <div className="settlement-panel">
      <div className="card settlement-summary-card">
        <div className="settlement-summary-lead">
          <span className="settlement-summary-label">Owed to vendors</span>
          <span className="settlement-summary-amount mono">
            {formatMoney(summary?.pending_amount ?? 0)}
          </span>
          <span className="settlement-summary-sub">
            {summary?.pending_count === 0
              ? "Nothing awaiting payment"
              : `across ${summary.pending_count} order${summary.pending_count === 1 ? "" : "s"} paid by wallet`}
          </span>
        </div>

        <dl className="settlement-stat-grid">
          <div className="settlement-stat">
            <dt>Settled to date</dt>
            <dd className="mono">{formatMoney(summary?.settled_amount ?? 0)}</dd>
            <span className="settlement-stat-count dim">
              {summary?.settled_count ?? 0} order{(summary?.settled_count ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
          <div className="settlement-stat">
            <dt>Voided</dt>
            <dd className="mono">{formatMoney(summary?.voided_amount ?? 0)}</dd>
            <span className="settlement-stat-count dim">
              {summary?.voided_count ?? 0} order{(summary?.voided_count ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
          <div className="settlement-stat">
            <dt>Vendors involved</dt>
            <dd className="mono">{summary?.vendor_count ?? 0}</dd>
            <span className="settlement-stat-count dim">
              {pendingBalances.length} awaiting payment
            </span>
          </div>
        </dl>
      </div>

      <p className="settlement-note dim small">
        Recording a payment only writes down that money has already changed hands
        outside this app. It does not transfer anything.
      </p>

      {/* Per-vendor breakdown: the starting point for paying someone their full
          outstanding balance in one go. */}
      <section className="settlement-section">
        <h3 className="section-title">Outstanding by vendor</h3>
        {balancesQuery.isLoading ? (
          <div className="center-row">
            <Spinner label="Loading vendor balances" />
          </div>
        ) : balancesQuery.isError ? (
          <ErrorState error={balancesQuery.error} onRetry={() => balancesQuery.refetch()} />
        ) : pendingBalances.length === 0 ? (
          <EmptyState
            title="No outstanding balances"
            hint="Every wallet-paid order has been settled. New amounts appear here as students pay by wallet."
            mascot={false}
            compact
          />
        ) : (
          <div className="settlement-table-wrap">
            <table className="settlement-table">
              <thead>
                <tr>
                  <th scope="col">Vendor</th>
                  <th scope="col" className="num">Owed</th>
                  <th scope="col" className="num">Orders</th>
                  <th scope="col" className="num">Settled to date</th>
                  <th scope="col" className="settlement-action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {pendingBalances.map((b) => (
                  <tr key={b.vendor_id}>
                    <td>
                      <span className="settlement-vendor-name">
                        {b.shop_name || b.vendor_name}
                      </span>
                    </td>
                    <td className="num mono">{formatMoney(b.pending_amount)}</td>
                    <td className="num mono">{b.pending_count}</td>
                    <td className="num mono dim">{formatMoney(b.settled_amount)}</td>
                    <td className="settlement-action-col">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setConfirm({ type: "bulk", vendor: b })}
                      >
                        Mark as Settled
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="settlement-section">
        <h3 className="section-title">All settlement records</h3>

        <div className="settlement-toolbar">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${statusFilter === f.id ? "chip-active" : ""}`}
              onClick={() => {
                setStatusFilter(f.id);
                setPage(0);
              }}
            >
              {f.label}
            </button>
          ))}
          <select
            className="input settlement-vendor-select"
            value={vendorFilter}
            onChange={(e) => {
              setVendorFilter(e.target.value);
              setPage(0);
            }}
            aria-label="Filter by vendor"
          >
            <option value="">All vendors</option>
            {balances.map((b) => (
              <option key={b.vendor_id} value={b.vendor_id}>
                {b.shop_name || b.vendor_name}
              </option>
            ))}
          </select>
          <span className="settlement-total dim small mono">
            {total} record{total === 1 ? "" : "s"}
          </span>
        </div>

        {listQuery.isLoading ? (
          <div className="center-row">
            <Spinner label="Loading settlement records" />
          </div>
        ) : listQuery.isError ? (
          <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No matching records"
            hint="Try a different status or vendor filter."
            mascot={false}
            compact
          />
        ) : (
          <div className="settlement-table-wrap">
            <table className="settlement-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Vendor</th>
                  <th scope="col">Date</th>
                  <th scope="col" className="num">Amount</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="settlement-action-col">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`settlement-row settlement-row-${r.status}`}>
                    <td className="mono">#{r.order_id}</td>
                    <td className="mono dim">vendor {r.vendor_id}</td>
                    <td className="dim">{formatDate(r.settled_at || r.created_at)}</td>
                    <td className="num mono">{formatMoney(r.amount)}</td>
                    <td>
                      <span className={`settlement-pill settlement-pill-${r.status}`}>
                        {STATUS_COPY[r.status] ?? r.status}
                      </span>
                      {r.status === "settled" && (
                        <span className="dim small settlement-pill-sub">
                          paid {formatDate(r.settled_at)}
                        </span>
                      )}
                    </td>
                    <td className="settlement-action-col">
                      {r.status === "pending" ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setConfirm({ type: "single", row: r })}
                        >
                          Mark as Settled
                        </button>
                      ) : (
                        <span className="dim small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pageCount > 1 && (
          <div className="settlement-pager">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span className="dim small mono">
              Page {page + 1} of {pageCount}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={page + 1 >= pageCount}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* One confirmation dialog for both actions, so the wording and the
          consequences are stated before anything is written. */}
      <Modal
        open={confirm !== null}
        title={confirm?.type === "bulk" ? "Record payment for full balance" : "Record this payment"}
        onClose={() => {
          if (!bulkSettleMutation.isPending && !markSettledMutation.isPending) {
            setConfirm(null);
          }
        }}
      >
        {confirm?.type === "bulk" ? (
          <div className="settlement-confirm">
            <p>
              Record a payment of{" "}
              <strong className="mono">{formatMoney(confirm.vendor.pending_amount)}</strong> to{" "}
              <strong>{confirm.vendor.shop_name || confirm.vendor.vendor_name}</strong>, covering{" "}
              {confirm.vendor.pending_count} pending order
              {confirm.vendor.pending_count === 1 ? "" : "s"}?
            </p>
            <p className="dim small">
              This marks every pending order for this vendor as settled under one
              payment record. It cannot be undone from here, and it does not move money.
            </p>
            {bulkError && <div className="form-error">{bulkError}</div>}
            <div className="settlement-confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={bulkSettleMutation.isPending}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={bulkSettleMutation.isPending}
                onClick={() => bulkSettleMutation.mutate(confirm.vendor.vendor_id)}
              >
                {bulkSettleMutation.isPending ? "Recording..." : "Mark as Settled"}
              </button>
            </div>
          </div>
        ) : confirm?.type === "single" ? (
          <div className="settlement-confirm">
            <p>
              Record a payment of{" "}
              <strong className="mono">{formatMoney(confirm.row.amount)}</strong> for order{" "}
              <strong className="mono">#{confirm.row.order_id}</strong> (vendor{" "}
              {confirm.row.vendor_id})?
            </p>
            <p className="dim small">
              This marks the settlement as settled and records your name and the time.
              It does not move money.
            </p>
            {singleError && <div className="form-error">{singleError}</div>}
            <div className="settlement-confirm-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={markSettledMutation.isPending}
                onClick={() => setConfirm(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={markSettledMutation.isPending}
                onClick={() => markSettledMutation.mutate(confirm.row.id)}
              >
                {markSettledMutation.isPending ? "Recording..." : "Mark as Settled"}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
