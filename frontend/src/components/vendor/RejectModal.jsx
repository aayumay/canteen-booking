import { useState } from "react";
import { formatMoney } from "../../lib/format.js";
import Modal from "../common/Modal.jsx";
import { Spinner } from "../common/Spinner.jsx";

export default function RejectModal({ order, onConfirm, onClose, pending, error }) {
  const [reason, setReason] = useState("");
  const valid = reason.trim().length > 0;

  return (
    <Modal open onClose={onClose} title={`Reject order #${order.id}`}>
      <p className="muted">
        Token <span className="mono strong">{order.pickup_token}</span>
        <span className="queue-card-total-inline mono">{formatMoney(order.total_amount)}</span>
      </p>
      <label className="field-label" htmlFor="reject-reason">
        Reason (required — shown to the student)
      </label>
      <textarea
        id="reject-reason"
        className="input textarea"
        rows={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="e.g. Ran out of batter for this batch"
        autoFocus
      />
      {error && (
        <div className="form-error" role="alert">
          {error.message}
        </div>
      )}
      <div className="btn-row">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={!valid || pending}
          onClick={() => onConfirm(reason.trim())}
        >
          {pending ? <Spinner size="sm" /> : "Reject order"}
        </button>
      </div>
    </Modal>
  );
}
