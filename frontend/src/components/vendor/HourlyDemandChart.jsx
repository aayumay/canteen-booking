import { useQuery } from "@tanstack/react-query";
import { vendorApi } from "../../api/vendorApi.js";
import { formatMoney } from "../../lib/format.js";
import { Spinner } from "../common/Spinner.jsx";
import ErrorState from "../common/ErrorState.jsx";

/** Campus opening hours. Everything outside this window is not worth plotting. */
const OPEN_HOUR = 7;
const CLOSE_HOUR = 22;

function Kpi({ label, value, accent }) {
  return (
    <div className="demand-kpi">
      <span className="demand-kpi-label">{label}</span>
      <span className={`demand-kpi-val ${accent ? "demand-kpi-val-accent" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function HourlyDemandChart() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["vendorHourlyDemand"],
    queryFn: vendorApi.getDemandByHour,
  });

  if (isLoading) {
    return (
      <div className="center-row" style={{ padding: "40px" }}>
        <Spinner size="lg" label="Analysing hourly kitchen demand..." />
      </div>
    );
  }

  if (isError) {
    return <ErrorState error={error} onRetry={() => refetch()} />;
  }

  const stats = Array.isArray(data) ? data : [];
  const activeHours = stats.filter((s) => s.hour >= OPEN_HOUR && s.hour <= CLOSE_HOUR);
  const totalOrders = activeHours.reduce((sum, s) => sum + (s.order_count || 0), 0);
  const totalRev = activeHours.reduce((sum, s) => sum + (s.revenue || 0), 0);
  const maxOrders = Math.max(...activeHours.map((s) => s.order_count || 0), 0);
  const peakHour = activeHours.reduce(
    (best, s) => ((s.order_count || 0) > (best?.order_count || 0) ? s : best),
    null
  );
  const currentHour = new Date().getHours();

  return (
    <div className="demand-panel">
      <div className="section-head">
        <div>
          <h2 className="section-title">Kitchen demand</h2>
          <p className="dim small" style={{ margin: "2px 0 0" }}>
            Which hours students actually order, so you can batch-cook and cut waste.
          </p>
        </div>
      </div>

      {/* Nothing to plot yet. Previously this rendered sixteen empty bars with
          every hour at zero, which read as a broken chart rather than no data. */}
      {totalOrders === 0 ? (
        <div className="demand-empty">
          <p className="demand-empty-title">No orders to analyse yet</p>
          <p className="demand-empty-hint">
            This chart fills in as students place orders. Once your stall has taken
            its first order, the busiest hours and your peak window show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="demand-kpis">
            <Kpi
              label="Peak hour"
              value={
                peakHour && peakHour.order_count > 0
                  ? `${peakHour.label} · ${peakHour.order_count}`
                  : "None yet"
              }
              accent
            />
            <Kpi label="Orders analysed" value={totalOrders} />
            <Kpi label="Demand value" value={formatMoney(totalRev)} />
          </div>

          <div className="demand-plot">
            {activeHours.map((h) => {
              const count = h.order_count || 0;
              const heightPercent = maxOrders > 0 ? (count / maxOrders) * 100 : 0;
              const isCurrent = h.hour === currentHour;
              const isPeak = peakHour?.hour === h.hour && count > 0;

              const barClass = [
                "demand-bar",
                isPeak ? "demand-bar-peak" : "",
                isCurrent ? "demand-bar-current" : "",
                count === 0 ? "demand-bar-empty" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div className="demand-col" key={h.hour}>
                  <span
                    className={`demand-count ${isPeak ? "demand-count-peak" : ""}`}
                  >
                    {count > 0 ? count : "·"}
                  </span>

                  <div
                    className={barClass}
                    style={{ height: `${Math.max(heightPercent, 3)}%` }}
                    title={`${h.label} — ${count} order${count === 1 ? "" : "s"} (${formatMoney(h.revenue)})`}
                  />

                  <span
                    className={`demand-hour ${isCurrent ? "demand-hour-current" : ""}`}
                  >
                    {h.label.slice(0, 2)}h
                  </span>
                </div>
              );
            })}
          </div>

          <div className="demand-legend">
            <span className="demand-legend-item">
              <span className="demand-swatch demand-swatch-peak" />
              Peak hour
            </span>
            <span className="demand-legend-item">
              <span className="demand-swatch demand-swatch-current" />
              Right now
            </span>
            <span className="demand-legend-item">
              <span className="demand-swatch" />
              Orders in that hour
            </span>
          </div>
        </>
      )}

      {isFetching && !isLoading ? (
        <p className="dim small" style={{ margin: "14px 0 0" }}>
          Refreshing…
        </p>
      ) : null}
    </div>
  );
}
