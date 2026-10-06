import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { playPop } from "../../lib/sounds.js";

export default function PickupToken({ token, orderId, status, size = "md", onExpand }) {
  const [copied, setCopied] = useState(false);

  if (!token) return null;

  const isTerminalCancelledOrRejected = status === "rejected" || status === "cancelled";
  const qrPayload = JSON.stringify({
    order_id: String(orderId ?? ""),
    pickup_token: String(token),
  });

  const handleCopy = (e) => {
    e.stopPropagation();
    playPop();
    navigator.clipboard?.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`token-stamp token-${size}`} onClick={onExpand} title="Click to view QR / copy">
      <div className="token-details" onClick={handleCopy}>
        <div className="token-header-row">
          <span className="token-label">PICKUP TOKEN</span>
          {copied && <span className="copied-pill">Copied!</span>}
        </div>
        <span className="token-number mono">{token}</span>
        <span className="token-hint">
          Show this code or QR at the counter to collect your order.
        </span>
      </div>

      {!isTerminalCancelledOrRejected && (
        <div className="token-qr-wrap" title="Scan to verify pickup">
          <div className="token-qr-inset">
            <QRCodeSVG
              value={qrPayload}
              size={size === "lg" ? 72 : size === "xs" ? 28 : 48}
              level="M"
              fgColor="#121212"
              bgColor="#FFFFFF"
            />
          </div>
        </div>
      )}
    </div>
  );
}
