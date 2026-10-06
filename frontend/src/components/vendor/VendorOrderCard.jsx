import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { vendorApi } from "../../api/vendorApi.js";
import { VENDOR_ACTION_LABELS, VENDOR_NEXT_ACTIONS } from "../../lib/orderStatus.js";
import { formatMoney, formatTime } from "../../lib/format.js";
import { Spinner } from "../common/Spinner.jsx";
import RejectModal from "./RejectModal.jsx";

export default function VendorOrderCard({ order }) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const hasItems = Boolean(order.items && order.items.length > 0);
  const detailQuery = useQuery({
    queryKey: ["vendorOrder", order.id],
    queryFn: () => vendorApi.getIncomingOrder(order.id),
    enabled: !hasItems,
    staleTime: 30_000,
  });
  const detail = hasItems ? order : detailQuery.data;

  const statusMutation = useMutation({
    mutationFn: ({ status, rejection_reason }) =>
      vendorApi.updateOrderStatus(order.id, { status, rejection_reason }),
    onSuccess: () => {
      setActionError(null);
      setRejecting(false);
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorOrder", order.id] });
    },
    onError: (err) => setActionError(err),
  });

  const nextActions = VENDOR_NEXT_ACTIONS[order.status] ?? [];
  const isNew = order.status === "placed";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className={`queue-card ${isNew ? "queue-card-placed" : ""}`}
    >
      <div className="queue-card-head">
        <span className="token-stamp token-xs">
          <span className="token-number mono">{order.pickup_token}</span>
        </span>
        <span className="queue-card-id mono">#{order.id}</span>
        <span className="queue-card-time mono dim">{formatTime(order.created_at)}</span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", margin: "4px 0 8px" }}>
        {order.reusable_container && (
          <span className="badge" style={{ fontSize: "0.68rem", padding: "2px 6px", background: "var(--color-sage-deep)", color: "var(--color-forest-deep)", fontWeight: 700 }}>
            BYO CONTAINER
          </span>
        )}
        {order.cutlery_needed === false && (
          <span className="badge" style={{ fontSize: "0.68rem", padding: "2px 6px", background: "rgba(51,92,48,0.2)", color: "var(--color-sage-deep)", border: "1px solid var(--color-forest)" }}>
            NO CUTLERY
          </span>
        )}
        {order.payment_method === "wallet" && (
          <span className="badge" style={{ fontSize: "0.68rem", padding: "2px 6px", background: "rgba(255,255,255,0.06)", color: "var(--color-text-muted)" }}>
            PREPAID WALLET
          </span>
        )}
        {order.payment_method === "meal_plan" && (
          <span className="badge" style={{ fontSize: "0.68rem", padding: "2px 6px", background: "rgba(242,153,74,0.15)", color: "#f2994a" }}>
            MEAL PASS
          </span>
        )}
      </div>

      <ul className="queue-card-items">
        {detail?.items ? (
          detail.items.map((it) => (
            <li key={it.id}>
              <span className="queue-card-item-name">{it.item_name}</span>
              <span className="mono dim">×{it.quantity}</span>
            </li>
          ))
        ) : (
          <li className="queue-card-items-loading">
            {detailQuery.isError ? "Couldn't load items." : <Spinner size="sm" label="Loading items" />}
          </li>
        )}
      </ul>

      <div className="queue-card-total mono">{formatMoney(order.total_amount)}</div>

      {actionError && <p className="queue-card-error" role="alert">{actionError.message}</p>}

      <div className="queue-card-actions">
        {nextActions.map((target) =>
          target === "rejected" ? (
            <button
              key={target}
              type="button"
              className="btn btn-danger-ghost btn-sm"
              onClick={() => setRejecting(true)}
              disabled={statusMutation.isPending}
            >
              Reject…
            </button>
          ) : (
            <button
              key={target}
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => statusMutation.mutate({ status: target })}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending && statusMutation.variables?.status === target ? (
                <Spinner size="sm" />
              ) : (
                VENDOR_ACTION_LABELS[target] ?? target
              )}
            </button>
          )
        )}
      </div>

      {rejecting && (
        <RejectModal
          order={order}
          pending={statusMutation.isPending}
          error={actionError}
          onClose={() => setRejecting(false)}
          onConfirm={(reason) =>
            statusMutation.mutate({ status: "rejected", rejection_reason: reason })
          }
        />
      )}
    </motion.article>
  );
}
