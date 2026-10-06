import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { walletApi } from "../api/walletApi.js";
import EmptyState from "../components/common/EmptyState.jsx";
import ErrorState from "../components/common/ErrorState.jsx";
import StaleStrip from "../components/common/StaleStrip.jsx";
import { Spinner } from "../components/common/Spinner.jsx";
import { playPop, playSuccess } from "../lib/sounds.js";

export default function StudentWallet() {
  const queryClient = useQueryClient();
  const [thresholdInput, setThresholdInput] = useState("");
  const [isEditingThreshold, setIsEditingThreshold] = useState(false);

  const { data: wallet, isLoading, isError, error, isRefetchError, isFetching, refetch } = useQuery({
    queryKey: ["studentWallet"],
    queryFn: walletApi.getWallet,
    refetchInterval: 15000,
  });

  const thresholdMutation = useMutation({
    mutationFn: walletApi.updateThreshold,
    onSuccess: () => {
      playSuccess();
      setIsEditingThreshold(false);
      queryClient.invalidateQueries({ queryKey: ["studentWallet"] });
    },
  });

  const handleSaveThreshold = (e) => {
    e.preventDefault();
    const val = parseFloat(thresholdInput);
    if (!isNaN(val) && val >= 0) {
      thresholdMutation.mutate(val);
    }
  };

  if (isLoading) {
    return (
      <div className="center-row" style={{ minHeight: "40vh" }}>
        <Spinner size="lg" label="Loading campus wallet" />
      </div>
    );
  }

  // Without this, a failed load fell through to `wallet?.balance ?? 0.0` and
  // rendered a confident "₹0.00" — indistinguishable from an empty wallet, and
  // enough to make a student with money top up unnecessarily.
  if (isError) {
    return (
      <div className="center-row" style={{ minHeight: "40vh", flexDirection: "column" }}>
        <ErrorState
          error={error}
          title="Couldn't load your wallet"
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const balance = wallet?.balance ?? 0.0;
  const isLow = wallet?.is_low_balance ?? false;
  const threshold = wallet?.low_balance_threshold ?? 50.0;
  const txs = wallet?.transactions ?? [];

  return (
    <div className="wallet-page">
      <StaleStrip
        isStale={isRefetchError}
        onRetry={() => refetch()}
        isRefetching={isFetching}
        label="Balance may be out of date"
      />
      {/* Balance Card */}
      <div className={`wallet-card ${isLow ? "wallet-card-low" : ""}`}>
        <div className="wallet-card-top">
          <div>
            <span className="wallet-label">CAMPUS PREPAID WALLET</span>
            <div className="wallet-balance-amt mono">₹{balance.toFixed(2)}</div>
          </div>
          {isLow && (
            <span className="low-bal-pill" role="status">
              Low Balance Alert
            </span>
          )}
        </div>

        <p className="wallet-desc">
          Official institutional prepaid balance. Used for cashless pickup orders across campus dining outlets.
        </p>

        <div className="wallet-threshold-bar">
          <span className="threshold-text">
            Alert trigger threshold: <strong className="mono">₹{threshold.toFixed(2)}</strong>
          </span>
          {!isEditingThreshold ? (
            <button
              type="button"
              className="linklike small"
              onClick={() => {
                playPop();
                setThresholdInput(threshold.toString());
                setIsEditingThreshold(true);
              }}
            >
              Adjust
            </button>
          ) : (
            <form onSubmit={handleSaveThreshold} className="threshold-inline-form">
              <input
                type="number"
                step="5"
                min="0"
                className="input input-sm mono"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                style={{ width: "80px" }}
                autoFocus
              />
              <button type="submit" className="btn btn-primary btn-sm" disabled={thresholdMutation.isPending}>
                Save
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setIsEditingThreshold(false)}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Notice on Top-ups */}
      <div className="wallet-info-note">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>To add balance, deposit cash or student accounts credit at the central Institution Accounts Desk.</span>
      </div>

      {/* Transaction History Ledger */}
      <div className="wallet-history-section">
        <h3 className="section-title">Transaction Ledger</h3>

        {txs.length === 0 ? (
          <EmptyState
            compact
            mascot={false}
            title="No transactions yet"
            hint="Top-ups, order payments and refunds will appear here."
          />
        ) : (
          <div className="tx-list">
            {txs.map((tx) => {
              const isCredit = tx.amount > 0;
              return (
                <div key={tx.id} className="tx-card">
                  <div className="tx-left">
                    <span className={`tx-type-pill pill-${tx.type}`}>
                      {tx.type.replace("_", " ")}
                    </span>
                    <div className="tx-reason">{tx.reason || "Wallet transaction"}</div>
                    <div className="tx-date">
                      {new Date(tx.created_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="tx-right">
                    <div className={`tx-amount mono ${isCredit ? "tx-credit" : "tx-debit"}`}>
                      {isCredit ? `+₹${tx.amount.toFixed(2)}` : `-₹${Math.abs(tx.amount).toFixed(2)}`}
                    </div>
                    <div className="tx-bal-after mono">Bal: ₹{tx.balance_after.toFixed(2)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
