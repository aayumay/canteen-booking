import { STATUS_LABELS, STATUS_TONE } from "../../lib/orderStatus.js";

export function StatusBadge({ status }) {
  const tone = STATUS_TONE[status] ?? "amber";
  return <span className={`badge badge-${tone}`}>{STATUS_LABELS[status] ?? status}</span>;
}
