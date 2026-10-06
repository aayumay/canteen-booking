import axios from "axios";
import { clearSession, readSession, writeSession } from "./session.js";
import { connectionStatus } from "../lib/connectionStatus.js";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

/** Flatten FastAPI error payloads ({detail: "..." | [{msg, ...}]}) into readable Errors. */
export function normalizeApiError(error) {
  let message = "Something went wrong. Please try again.";
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    message = detail.map((d) => d?.msg ?? JSON.stringify(d)).join("; ");
  } else if (error?.code === "ERR_NETWORK") {
    message = "Connection lost. Please check your internet connection and try again.";
  } else if (error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT") {
    message = "The server took too long to respond. Please try again.";
  } else if (error?.message) {
    message = error.message;
  }

  const err = new Error(message);
  err.status = status;
  err.isApiError = true;
  return err;
}

const axiosClient = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 20000,
});

// Attach the JWT to every request.
axiosClient.interceptors.request.use((config) => {
  const session = readSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

function redirectToLogin() {
  clearSession();
  const current = window.location.pathname + window.location.search;
  if (!window.location.pathname.startsWith("/login")) {
    window.location.assign(`/login?expired=1&next=${encodeURIComponent(current)}`);
  }
}

axiosClient.interceptors.response.use(
  (response) => {
    // A completed round trip is the only trustworthy "we're back" signal.
    connectionStatus.markSuccess();
    return response;
  },
  async (error) => {
    // Classify before any auth handling: a 4xx/5xx still proves the API is
    // reachable, so it must not count as a connectivity failure.
    connectionStatus.markRequestResult(error);

    const originalRequest = error?.config;
    const status = error?.response?.status;
    const url = originalRequest?.url || "";

    // Auth endpoints (login, request-otp, verify-otp, refresh) shouldn't trigger refresh logic
    const isAuthEndpoint = url.includes("/auth/");

    if (status === 401 && !isAuthEndpoint && originalRequest && !originalRequest._retry) {
      const session = readSession();

      if (!session?.refreshToken) {
        redirectToLogin();
        return Promise.reject(normalizeApiError(error));
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosClient(originalRequest);
          })
          .catch((err) => Promise.reject(normalizeApiError(err)));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: session.refreshToken,
        });

        const newSession = {
          ...session,
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        };
        writeSession(newSession);

        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        processQueue(null, data.access_token);
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // A transport failure here means we never reached the auth server, which
        // says nothing about whether the session is still valid. Logging the
        // user out on a dropped connection would destroy a perfectly good
        // session, so only a real rejection from the auth server ends it.
        const refreshStatus = refreshError?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          redirectToLogin();
        } else {
          connectionStatus.markRequestResult(refreshError);
        }
        return Promise.reject(normalizeApiError(refreshError));
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 401 && !isAuthEndpoint) {
      redirectToLogin();
    }

    return Promise.reject(normalizeApiError(error));
  }
);

export default axiosClient;

