import { useEffect, useState, useRef } from 'react';

function formatINR(amount) {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

function AnimatedCounter({ target, duration = 1800, prefix = '₹' }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!target) return;
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => ref.current && cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return (
    <span>
      {target >= 100000
        ? `${prefix}${(value / 100000).toFixed(1)}L`
        : target >= 1000
          ? `${prefix}${(value / 1000).toFixed(1)}K`
          : `${prefix}${value.toLocaleString('en-IN')}`}
    </span>
  );
}

function ROIGauge({ percentage }) {
  const clampedPct = Math.min(Math.max(percentage, 0), 999);
  const barWidth = Math.min(clampedPct / 5, 100);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-command-muted">ROI</span>
        <span
          className={`font-bold ${clampedPct >= 200 ? 'text-emerald-400' : clampedPct >= 100 ? 'text-command-success' : 'text-command-warning'}`}
        >
          {clampedPct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-command-bg/80">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: `${barWidth}%`,
            background:
              clampedPct >= 200
                ? 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)'
                : clampedPct >= 100
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
          }}
        />
      </div>
    </div>
  );
}

export default function ROICard({ shiftData, analytics }) {
  const summary = shiftData?.summary || {};
  const assignments = shiftData?.assignments || [];

  const totalSavings = summary.total_estimated_savings_inr || 0;
  const totalOfficerCost = summary.total_officer_cost_inr || 0;
  const roiPercentage = summary.roi_percentage || 0;
  const totalEconomicImpact = summary.total_economic_impact_inr || 0;
  const totalOfficers = summary.total_officers_recommended || 0;
  const dailyLoss = analytics?.kpis?.daily_economic_loss_inr || 0;

  const topZones = [...assignments]
    .sort((a, b) => b.estimated_savings_inr - a.estimated_savings_inr)
    .slice(0, 4);
  const maxSavings = topZones.length > 0 ? topZones[0].estimated_savings_inr : 1;

  const isPositiveROI = totalSavings > totalOfficerCost;

  return (
    <div
      id="roi-card"
      className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-command-panel p-6 interactive-card shadow-sm"
    >
      {/* Subtle gradient glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          background: isPositiveROI
            ? 'radial-gradient(ellipse at top right, rgba(16,185,129,0.3), transparent 60%)'
            : 'radial-gradient(ellipse at top right, rgba(245,158,11,0.3), transparent 60%)',
        }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-command-muted">
              Estimated Savings on Action
            </p>
            <p className="mt-2 text-3xl font-bold text-emerald-400">
              <AnimatedCounter target={totalSavings} />
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Net savings after deploying {totalOfficers} officers
            </p>
          </div>
          <div
            className={`flex items-center gap-1 rounded-lg px-3 py-1 text-xs font-bold ${
              isPositiveROI
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-command-warning/20 text-command-warning'
            }`}
          >
            {isPositiveROI ? (
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            ) : (
              <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            )}
            <span>{isPositiveROI ? 'PROFITABLE' : 'LOW ROI'}</span>
          </div>
        </div>

        {/* ROI Gauge */}
        <ROIGauge percentage={roiPercentage} />

        {/* Cost vs Benefit Breakdown */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-command-bg/50 p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-command-muted">
              Gross Benefit
            </p>
            <p className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
              {formatINR(totalSavings + totalOfficerCost)}
            </p>
          </div>
          <div className="rounded-lg bg-command-bg/50 p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-command-muted">
              Officer Cost
            </p>
            <p className="mt-1 text-sm font-semibold text-command-danger">
              −{formatINR(totalOfficerCost)}
            </p>
          </div>
          <div className="rounded-lg bg-command-bg/50 p-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-wider text-command-muted">
              Net Savings
            </p>
            <p className="mt-1 text-sm font-semibold text-emerald-400">
              +{formatINR(totalSavings)}
            </p>
          </div>
        </div>

        {/* Per-Zone ROI Bars */}
        {topZones.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-command-muted">
              Top Zones by Savings
            </p>
            {topZones.map((zone) => {
              const pct = maxSavings > 0 ? (zone.estimated_savings_inr / maxSavings) * 100 : 0;
              return (
                <div key={zone.zone} className="group">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400 transition-colors group-hover:text-gray-900 dark:group-hover:text-white">
                      {zone.zone}
                    </span>
                    <span className="font-medium text-emerald-400">
                      {formatINR(zone.estimated_savings_inr)}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-command-bg/80">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-700 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer insight */}
        <div className="mt-4 rounded-lg border border-command-border bg-command-bg/30 px-3 py-2">
          <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 font-bold text-gray-900 dark:text-white">
              <svg className="h-3.5 w-3.5 text-command-warning shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              Insight:
            </span>{' '}
            <span>
              {roiPercentage >= 200
                ? `Every ₹1 spent on officers saves ₹${(roiPercentage / 100).toFixed(1)} in fuel & productivity losses.`
                : roiPercentage >= 100
                  ? `Deployment breaks even and saves ${formatINR(totalSavings)} daily in congestion costs.`
                  : `Increasing officers at high-loss zones can improve ROI from current ${roiPercentage}%.`}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
