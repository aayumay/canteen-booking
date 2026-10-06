import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { connectionStatus } from "../lib/connectionStatus.js";
import ConnectionBanner from "../components/common/ConnectionBanner.jsx";

const NetworkStatusContext = createContext({
  isOffline: false,
  isFlapping: false,
  consecutiveFailures: 0,
  retryNow: () => {},
});

/**
 * Owns the app's connection state and keeps cached data honest around it.
 *
 * Two responsibilities:
 *  1. Render a persistent banner while the app can't reach the API.
 *  2. Refetch as soon as a request actually succeeds again, so anything the
 *     user looked at while disconnected is replaced immediately rather than
 *     lingering until its next poll.
 */
export function NetworkStatusProvider({ children }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState(() => connectionStatus.getState());
  const lastReconnect = useRef(state.reconnectCount);

  useEffect(() => connectionStatus.subscribe(setState), []);

  // Fires when a real request lands after a confirmed outage. Invalidate active
  // queries only: inactive ones are marked stale and refresh on next mount, so a
  // reconnect doesn't fan out into a burst of requests for screens nobody has
  // open.
  useEffect(() => {
    if (state.reconnectCount === lastReconnect.current) return;
    lastReconnect.current = state.reconnectCount;
    queryClient.invalidateQueries({ refetchType: "active" });
  }, [state.reconnectCount, queryClient]);

  const retryNow = useCallback(async () => {
    await queryClient.invalidateQueries({ refetchType: "active" });
  }, [queryClient]);

  return (
    <NetworkStatusContext.Provider value={{ ...state, retryNow }}>
      {children}
      <ConnectionBanner isOffline={state.isOffline} onRetry={retryNow} />
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkStatusContext);
}
