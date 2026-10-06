import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { vendorApi } from "../api/vendorApi.js";
import { useAuth } from "../hooks/useAuth.js";
import { useReducedMotion } from "../components/landing/motion.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import StaleStrip from "../components/common/StaleStrip.jsx";
import { formatMoney } from "../lib/format.js";
import {
  isPickupMuted,
  setPickupMuted,
  playPickupChime,
  playPickupError,
  vibratePickup,
} from "../lib/pickupFeedback.js";

const READER_ID = "pickup-qr-reader";
const DUPLICATE_WINDOW_MS = 4000;
const TOKEN_RE = /^\d{6}$/;

const ACTIVE_STATUSES = ["placed", "accepted", "preparing", "ready"];

function describeItems(order) {
  if (!order?.items?.length) return "No items listed";
  const parts = order.items.map((i) => `${i.quantity}x ${i.item_name}`);
  if (parts.length <= 3) return parts.join(", ");
  return `${parts.slice(0, 3).join(", ")} +${parts.length - 3} more`;
}

function describeStatus(status) {
  return String(status || "").replace(/_/g, " ");
}

/**
 * Tolerant QR payload reader. The student ticket encodes
 * `{"order_id": "...", "pickup_token": "..."}`; a bare 6-digit code is also
 * accepted so a printed slip or mis-encoded label still works.
 */
function parsePayload(text) {
  const raw = (text || "").trim();
  if (TOKEN_RE.test(raw)) return { pickup_token: raw };

  try {
    const parsed = JSON.parse(raw);
    const token = String(parsed.pickup_token ?? "").trim();
    const rawId = parsed.order_id;
    const orderId =
      rawId === undefined || rawId === null || rawId === ""
        ? NaN
        : Number(rawId);
    if (TOKEN_RE.test(token)) {
      return {
        pickup_token: token,
        ...(Number.isFinite(orderId) ? { order_id: orderId } : {}),
      };
    }
  } catch {
    /* not JSON */
  }
  return null;
}

function cameraErrorMessage(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
    return "Camera permission was blocked. Allow camera access in your browser settings, or use the manual code and ready-order options below.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") {
    return "No usable camera was found on this device. Use the manual code or ready-order options below.";
  }
  if (name === "NotReadableError") {
    return "The camera is already in use by another app.";
  }
  return err?.message || "Could not start the camera.";
}

export default function VendorScan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion();

  const scannerRef = useRef(null);
  const lastDecodeRef = useRef({ value: null, at: 0 });
  const torchOnRef = useRef(false);
  const handleDecodedRef = useRef(null);

  const [stage, setStage] = useState("scan"); // scan | preview | done
  const [cameraWanted, setCameraWanted] = useState(false);
  const [cameraState, setCameraState] = useState("off"); // off|starting|on
  const [cameraError, setCameraError] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchUnsupported, setTorchUnsupported] = useState(false);
  const [muted, setMuted] = useState(isPickupMuted());
  const [manualCode, setManualCode] = useState("");
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);

  const secure = typeof window !== "undefined" && Boolean(window.isSecureContext);

  const readyQuery = useQuery({
    queryKey: ["vendorReadyOrders"],
    queryFn: () => vendorApi.listReadyOrders(),
    refetchInterval: 15000,
  });

  // Needed to resolve a hand-typed code to an order for the preview step.
  const ordersQuery = useQuery({
    queryKey: ["vendorOrders"],
    queryFn: () => vendorApi.listIncomingOrders(),
    staleTime: 10000,
  });

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    torchOnRef.current = false;
    setTorchOn(false);
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch {
      /* the stream may already be gone */
    }
  }, []);

  /**
   * Turn a decoded payload into a preview card. Nothing is written here — the
   * order only changes status when the vendor confirms.
   */
  const buildPreview = useCallback(
    async (payload) => {
      setResult(null);

      let order = null;
      if (payload.order_id) {
        try {
          order = await vendorApi.getIncomingOrder(payload.order_id);
        } catch {
          order = null;
        }
      } else {
        const all = ordersQuery.data ?? [];
        order = all.find((o) => o.pickup_token === payload.pickup_token) ?? null;
      }

      if (!order) {
        playPickupError();
        vibratePickup([30]);
        setResult({ kind: "error", message: "That code doesn't match any of your orders." });
        return;
      }
      if (order.status === "picked_up") {
        playPickupError();
        vibratePickup([30]);
        setResult({ kind: "error", message: "This order was already picked up." });
        return;
      }
      if (["cancelled", "rejected"].includes(order.status)) {
        playPickupError();
        vibratePickup([30]);
        setResult({ kind: "error", message: `This order was ${describeStatus(order.status)}.` });
        return;
      }
      if (order.status !== "ready") {
        playPickupError();
        vibratePickup([30]);
        setResult({
          kind: "error",
          message: `Not ready for pickup yet — this order is ${describeStatus(order.status)}.`,
        });
        return;
      }

      setPreview({
        order,
        // The ready list only holds the last 4 digits of the code, so fall back
        // to the full code from the order record for the confirm call.
        pickup_token: payload.pickup_token ?? order.pickup_token,
        // Only the ready-orders endpoint knows the student's name.
        studentName: payload.student_name ?? null,
      });
      setStage("preview");
      setCameraWanted(false);
    },
    [ordersQuery.data]
  );

  const handleDecoded = useCallback(
    async (decodedText) => {
      // Stop reading frames straight away so one code can't fire twice.
      const scanner = scannerRef.current;
      if (scanner?.isScanning) {
        try {
          scanner.pause(true);
        } catch {
          /* ignore */
        }
      }

      const now = Date.now();
      const last = lastDecodeRef.current;
      if (last.value === decodedText && now - last.at < DUPLICATE_WINDOW_MS) return;
      lastDecodeRef.current = { value: decodedText, at: now };

      const payload = parsePayload(decodedText);
      if (!payload) {
        playPickupError();
        vibratePickup([30]);
        setResult({ kind: "error", message: "That QR code isn't a pickup code." });
        return;
      }
      await buildPreview(payload);
    },
    [buildPreview]
  );

  // The camera effect is long-lived, so it reads the latest handler through a
  // ref instead of closing over a stale one.
  handleDecodedRef.current = handleDecoded;

  /**
   * Camera lifecycle is driven by an effect rather than imperative calls:
   * html5-qrcode needs its container present in the DOM, and an effect only
   * runs after React has committed the scan-stage markup.
   */
  useEffect(() => {
    if (stage !== "scan" || !cameraWanted) {
      stopScanner();
      return undefined;
    }

    let cancelled = false;
    setCameraState("starting");
    setCameraError(null);

    (async () => {
      try {
        const scanner = new Html5Qrcode(READER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
          (text) => {
            if (!cancelled) handleDecodedRef.current?.(text);
          },
          () => {
            /* per-frame misses are normal */
          }
        );

        if (cancelled) {
          try {
            if (scanner.isScanning) await scanner.stop();
            scanner.clear();
          } catch {
            /* ignore */
          }
          return;
        }

        setCameraState("on");

        // Torch is optional hardware; probe once so the control can be hidden.
        try {
          const cams = await Html5Qrcode.getCameras();
          const back = cams.find((c) => /back|rear|environment/i.test(c.label || ""));
          const caps = back?.getCapabilities?.();
          setTorchUnsupported(!caps || !("torch" in caps));
        } catch {
          setTorchUnsupported(true);
        }
      } catch (err) {
        if (cancelled) return;
        setCameraState("off");
        setCameraWanted(false);
        setCameraError(cameraErrorMessage(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [stage, cameraWanted, stopScanner]);

  // Release the camera on unmount.
  useEffect(() => () => { stopScanner(); }, [stopScanner]);

  const toggleTorch = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    const next = !torchOnRef.current;
    try {
      await scanner.applyVideoConstraints({ advanced: [{ torch: next }] });
      torchOnRef.current = next;
      setTorchOn(next);
    } catch {
      setTorchUnsupported(true);
    }
  }, []);

  const verifyMutation = useMutation({
    mutationFn: () =>
      vendorApi.verifyPickup({
        order_id: preview.order.id,
        pickup_token: preview.pickup_token,
      }),
    onSuccess: () => {
      playPickupChime();
      vibratePickup();
      setResult({ kind: "success", message: "Handover confirmed." });
      setStage("done");
      setPreview(null);
      setManualCode("");
      queryClient.invalidateQueries({ queryKey: ["vendorReadyOrders"] });
      queryClient.invalidateQueries({ queryKey: ["vendorOrders"] });
    },
    onError: (err) => {
      playPickupError();
      vibratePickup([30]);
      setResult({ kind: "error", message: err.message || "Could not confirm this pickup." });
    },
  });

  const cancelPreview = () => {
    setPreview(null);
    setResult(null);
    lastDecodeRef.current = { value: null, at: 0 };
    setStage("scan");
    setCameraWanted(true);
  };

  const scanAnother = () => {
    setPreview(null);
    setResult(null);
    setManualCode("");
    lastDecodeRef.current = { value: null, at: 0 };
    setStage("scan");
    setCameraWanted(true);
  };

  const submitManual = (e) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!TOKEN_RE.test(code)) {
      setResult({ kind: "error", message: "Enter the 6-digit pickup code." });
      return;
    }
    buildPreview({ pickup_token: code });
  };

  const toggleMute = () => {
    setMuted((prev) => {
      const next = !prev;
      setPickupMuted(next);
      return next;
    });
  };

  const readyOrders = readyQuery.data ?? [];
  const manualValid = TOKEN_RE.test(manualCode.trim());
  const tone = result?.kind === "success" ? "success" : "error";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-shopname">{user?.shop_name ?? "Your canteen"}</span>
        </div>
        <div className="topbar-user">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate("/vendor")}
          >
            Back to orders
          </button>
        </div>
      </header>

      <main className={`page pickup-scan-page${reducedMotion ? " reduced-motion" : ""}`}>
        <div className="pickup-scan-head">
          <h1 className="section-title">Verify Pickup</h1>
          <p className="muted small">
            Scan the student's QR ticket, type their code, or pick from the ready list.
          </p>
        </div>

        {result && (
          <div
            className={`pickup-banner pickup-banner-${tone}`}
            role="status"
            aria-live="polite"
          >
            {result.message}
          </div>
        )}

        {stage === "done" ? (
          <div className="card pickup-done-card">
            <div className="pickup-done-glyph" aria-hidden="true">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 className="section-title">Handover confirmed</h2>
            <p className="muted small">The order is now marked as picked up.</p>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" onClick={scanAnother}>
                Scan next order
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/vendor")}
              >
                Back to orders
              </button>
            </div>
          </div>
        ) : stage === "preview" && preview ? (
          <div className="card pickup-preview-card">
            <h2 className="section-title">Confirm handover</h2>
            <p className="muted small">
              Check the details below before handing over the order.
            </p>

            <dl className="pickup-preview-list">
              {preview.studentName && (
                <div className="pickup-preview-row">
                  <dt>Student</dt>
                  <dd>{preview.studentName}</dd>
                </div>
              )}
              <div className="pickup-preview-row">
                <dt>Order</dt>
                <dd className="mono">#{preview.order.id}</dd>
              </div>
              <div className="pickup-preview-row">
                <dt>Items</dt>
                <dd>{describeItems(preview.order)}</dd>
              </div>
              <div className="pickup-preview-row">
                <dt>Total</dt>
                <dd>{formatMoney(preview.order.total_amount)}</dd>
              </div>
              <div className="pickup-preview-row">
                <dt>Pickup code</dt>
                <dd className="mono pickup-preview-token">{preview.pickup_token}</dd>
              </div>
            </dl>

            <div className="btn-row">
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending ? <Spinner size="sm" /> : "Confirm Handover"}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={cancelPreview}
                disabled={verifyMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <section className="card pickup-camera-card">
              <div className="pickup-camera-head">
                <h3 className="verifier-title">Scan student QR</h3>
                <div className="pickup-camera-controls">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={toggleMute}
                    aria-pressed={!muted}
                  >
                    {muted ? "Sound off" : "Sound on"}
                  </button>
                  {!torchUnsupported && cameraState === "on" && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={toggleTorch}
                      aria-pressed={torchOn}
                    >
                      {torchOn ? "Torch off" : "Torch on"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setCameraWanted((w) => !w)}
                    disabled={cameraState === "starting"}
                  >
                    {cameraState === "on"
                      ? "Pause camera"
                      : cameraState === "starting"
                        ? "Starting..."
                        : "Start camera"}
                  </button>
                </div>
              </div>

              {!secure && (
                <div className="pickup-inline-note" role="note">
                  The camera needs a secure (HTTPS) connection. It still works on
                  localhost during development.
                </div>
              )}

              <div id={READER_ID} className="pickup-reader" />

              {cameraState === "starting" && (
                <div className="center-row">
                  <Spinner size="md" label="Starting camera" />
                </div>
              )}

              {cameraError && (
                <div className="pickup-inline-note pickup-inline-note-warn" role="alert">
                  {cameraError}
                </div>
              )}

              {cameraState === "off" && !cameraError && (
                <p className="muted small">
                  Point the camera at the student's ticket QR code, then tap Start camera.
                </p>
              )}
            </section>

            <section className="card">
              <h3 className="verifier-title">Or enter the code</h3>
              <form className="token-verifier-input-row" onSubmit={submitManual}>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="input mono input-sm uppercase"
                  placeholder="6-DIGIT CODE"
                  aria-label="Pickup code"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.replace(/\D/g, ""))}
                />
                <button type="submit" className="btn btn-primary btn-sm" disabled={!manualValid}>
                  Verify
                </button>
              </form>
            </section>

            <section className="card">
              <h3 className="verifier-title">Ready orders</h3>
              <StaleStrip
                isStale={readyQuery.isRefetchError}
                onRetry={() => readyQuery.refetch()}
                isRefetching={readyQuery.isFetching}
                label="Ready list may be out of date"
              />
              {readyQuery.isLoading ? (
                <div className="center-row">
                  <Spinner size="sm" label="Loading ready orders" />
                </div>
              ) : readyOrders.length === 0 ? (
                <EmptyState
                  title="Nothing waiting"
                  hint="Orders appear here once you mark them ready."
                />
              ) : (
                <ul className="pickup-ready-list">
                  {readyOrders.map((o) => (
                    <li key={o.id}>
                      <button
                        type="button"
                        className="pickup-ready-item"
                        onClick={() =>
                          buildPreview({ order_id: o.id, student_name: o.student_name })
                        }
                      >
                        <span className="pickup-ready-main">
                          <span className="pickup-ready-name">{o.student_name}</span>
                          <span className="pickup-ready-items">{o.item_summary}</span>
                        </span>
                        <span className="mono pickup-ready-code">•{o.pickup_token_last4}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
