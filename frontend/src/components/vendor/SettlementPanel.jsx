import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import ErrorState from "../common/ErrorState.jsx";
import EmptyState from "../common/EmptyState.jsx";
import { Spinner } from "../common/Spinner.jsx";
import StaleStrip from "../common/StaleStrip.jsx";
import { formatMoney } from "../../lib/format.js";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Awaiting payment" },
  { id: "settled", label: "Settled" },
  { id: "voided", label: "Cancelled" },
];

const PAGE_SIZE = 25;

const STATUS_COPY = {
  pending: "Awaiting payment",
  settled: "Settled",
  voided: "Cancelled",
};

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

/**
 * Read-only view of what the canteen has earned and what has actually been paid.
 *
 * A vendor can see their balance and the history behind it, but cannot mark
 * anything settled: recording a payment is an admin action, because it is a
 * financial acknowledgement and must leave an audit trail on the admin's
 * side. So there are no buttons here on purpose.
 */
export default function SettlementPanel() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);

  const summaryQuery = useQuery({
    queryKey: ["vendorSettlementSummary"],
    queryFn: () => vendorApi.getSettlementSummary(),
  });

  const listQuery = useQuery({
    queryKey: ["vendorSettlements", statusFilter, page],
    queryFn: () =>
      vendorApi.listSettlements({
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
  });

  const summary = summaryQuery.data;
  const rows = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // A stale refetch keeps the last known ledger on screen rather than blanking
  // it, but the vendor has to know it may not be current.
  const showStaleStrip =
    (summaryQuery.isError || listQuery.isError) ||
    summaryQuery.isRefetchError ||
    listQuery.isRefetchError;

  if (summaryQuery.isLoading) {
    return (
      <div className="center-row">
        <Spinner size="lg" label="Loading your settlement balance" />
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <ErrorState error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
    );
  }

  // No wallet-paid orders at all is different from "everything is paid up":
  // the first means the canteen has not earned through the wallet yet, and
  // saying "you're all settled" there would be wrong.
  const hasNoHistory = (summary?.pending_count ?? 0) === 0 && (summary?.settled_count ?? 0) === 0;

  return (
    <div className="settlement-panel">
      <StaleStrip
        isStale={showStaleStrip}
        onRetry={() => {
          summaryQuery.refetch();
          listQuery.refetch();
        }}
        isRefetching={summaryQuery.isFetching || listQuery.isFetching}
        label="Settlement figures may be out of date"
      />

      <div className="card settlement-summary-card">
        <div className="settlement-summary-lead">
          <span className="settlement-summary-label">Owed to you</span>
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
            <dt>Cancelled orders</dt>
            <dd className="mono">{formatMoney(summary?.voided_amount ?? 0)}</dd>
            <span className="settlement-stat-count dim">
              {summary?.voided_count ?? 0} order{(summary?.voided_count ?? 0) === 1 ? "" : "s"}
            </span>
          </div>
        </dl>
      </div>

      <p className="settlement-note dim small">
        Payments are made by the campus office outside this app. Once they confirm a
        transfer, your balance updates here.
      </p>

      {hasNoHistory ? (
        <EmptyState
          title="No wallet-paid orders yet"
          hint="When a student pays for one of your items from their canteen wallet, the amount you are owed will be listed here."
        />
      ) : (
        <>
          <div className="settlement-toolbar" role="tablist" aria-label="Filter settlements">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={statusFilter === f.id}
                className={`chip ${statusFilter === f.id ? "chip-active" : ""}`}
                onClick={() => {
                  setStatusFilter(f.id);
                  setPage(0);
                }}
              >
                {f.label}
              </button>
            ))}
            <span className="settlement-total dim small mono">
              {total} record{total === 1 ? "" : "s"}
            </span>
          </div>

          {listQuery.isLoading ? (
            <div className="center-row">
              <Spinner label="Loading settlement history" />
            </div>
          ) : listQuery.isError ? (
            <ErrorState error={listQuery.error} onRetry={() => listQuery.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No matching records"
              hint="Try a different filter to see the rest of your settlement history."
              mascot={false}
              compact
            />
          ) : (
            <div className="settlement-table-wrap">
              <table className="settlement-table">
                <thead>
                  <tr>
                    <th scope="col">Order</th>
                    <th scope="col">Pickup token</th>
                    <th scope="col">Date</th>
                    <th scope="col" className="num">Amount</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={`settlement-row settlement-row-${r.status}`}>
                      <td className="mono">#{r.order_id}</td>
                      <td className="mono">{r.pickup_token || "—"}</td>
                      <td className="dim">{formatDate(r.settled_at || r.created_at)}</td>
                      <td className="num mono">
                        {formatMoney(r.amount)}
                      </td>
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
        </>
      )}
    </div>
  );
}
