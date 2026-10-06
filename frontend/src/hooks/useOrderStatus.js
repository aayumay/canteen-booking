import { useCallback, useEffect, useRef, useState } from "react";
import { isTerminalStatus } from "../lib/orderStatus.js";

export const ORDER_POLL_INTERVAL_MS = 4000;

/**
 * Consecutive failures before the UI admits the data might be out of date.
 * One dropped packet on a phone is routine; announcing it would train people to
 * ignore the warning that actually matters.
 */
export const ORDER_STALE_THRESHOLD = 3;

/**
 * Polls a single order every few seconds until it reaches a terminal status
 * (picked_up / rejected / cancelled).
 *
 * Never stops on error. A failed poll leaves the last known order on screen and
 * is only reported as `error` once `ORDER_STALE_THRESHOLD` attempts in a row
 * have failed, at which point `isStale` also goes true so the view can offer a
 * manual refresh instead of a scary panel.
 *
 * @param {number|null} orderId
 * @param {(orderId: number) => Promise<object>} fetchOrder  e.g. studentApi.getMyOrder
 * @param {object|null} initialOrder  already-known list row for instant first paint
 */
export function useOrderStatus(orderId, fetchOrder, initialOrder = null) {
  const [order, setOrder] = useState(initialOrder);
  const [isLoading, setIsLoading] = useState(orderId != null && !initialOrder);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [nonce, setNonce] = useState(0);

  const fetchRef = useRef(fetchOrder);
  fetchRef.current = fetchOrder;

  // Survives re-renders so the failure count is per-order, not per-render.
  const failuresRef = useRef(0);

  // Reset tracked state when pointed at a different order.
  useEffect(() => {
    setOrder(initialOrder);
    setError(null);
    setIsStale(false);
    setLastSyncedAt(null);
    failuresRef.current = 0;
    setIsLoading(orderId != null && !initialOrder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  useEffect(() => {
    if (orderId == null) return undefined;
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      // Don't burn requests while the tab is hidden.
      if (typeof document !== "undefined" && document.hidden) {
        timer = setTimeout(tick, ORDER_POLL_INTERVAL_MS);
        return;
      }
      try {
        const data = await fetchRef.current(orderId);
        if (cancelled) return;
        failuresRef.current = 0;
        setOrder(data);
        setError(null);
        setIsStale(false);
        setIsLoading(false);
        setIsRefreshing(false);
        setLastSyncedAt(new Date().toISOString());
        // Terminal status: stop polling. This is the only scheduling decision,
        // so a WebSocket swap just replaces this whole block.
        if (!isTerminalStatus(data?.status)) {
          timer = setTimeout(tick, ORDER_POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        failuresRef.current += 1;
        setIsLoading(false);
        setIsRefreshing(false);
        // Below the threshold this is a blip: keep the last known order, stay
        // silent, and try again on the normal cadence.
        if (failuresRef.current >= ORDER_STALE_THRESHOLD) {
          setIsStale(true);
          setError(err);
        }
        timer = setTimeout(tick, ORDER_POLL_INTERVAL_MS);
      }
    };

    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [orderId, nonce]);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setNonce((n) => n + 1);
  }, []);

  return { order, isLoading, error, isStale, isRefreshing, lastSyncedAt, refresh };
}
