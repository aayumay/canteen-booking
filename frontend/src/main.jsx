import React from "react";
import ReactDOM from "react-dom/client";
import * as Sentry from "@sentry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";
import { LanguageProvider } from "./contexts/LanguageContext.jsx";
import { NetworkStatusProvider } from "./contexts/NetworkStatusContext.jsx";
import "./index.css";

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE || "production",
    // Tracing every interaction costs measurable frame time on mid-range
    // phones. Errors still report in full; performance traces are sampled.
    tracesSampleRate: 0.2,
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
    mutations: {
      retry: 0,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={({ error }) => (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Something went wrong.</h2>
        <p style={{ color: "#666" }}>{error?.message || "An unexpected error occurred."}</p>
        <button onClick={() => window.location.reload()} style={{ marginTop: "1rem", padding: "0.5rem 1rem", cursor: "pointer" }}>
          Reload Page
        </button>
      </div>
    )}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <NetworkStatusProvider>
            <AuthProvider>
              <LanguageProvider>
                <App />
              </LanguageProvider>
            </AuthProvider>
          </NetworkStatusProvider>
        </MotionConfig>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
