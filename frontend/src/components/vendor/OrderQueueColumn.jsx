import { AnimatePresence } from "framer-motion";
import { STATUS_LABELS, STATUS_TONE } from "../../lib/orderStatus.js";
import VendorOrderCard from "./VendorOrderCard.jsx";

export default function OrderQueueColumn({ status, orders }) {
  const tone = STATUS_TONE[status] ?? "orange";
  return (
    <section className={`queue-col queue-col-${tone}`} aria-label={`${STATUS_LABELS[status]} orders`}>
      <header className="queue-col-head">
        <h3 className="queue-col-title">{STATUS_LABELS[status] ?? status}</h3>
        <span className="queue-col-count mono">{orders.length}</span>
      </header>
      <div className="queue-col-body">
        {orders.length === 0 ? (
          <p className="queue-col-empty" aria-hidden="true">—</p>
        ) : (
          <AnimatePresence mode="popLayout">
            {orders.map((order) => <VendorOrderCard key={order.id} order={order} />)}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
