"use client";

import type { AIBriefing } from "@/lib/types";

interface Props {
  briefing: AIBriefing | null;
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
}

export default function AIBriefingPanel({
  briefing,
  loading,
  expanded,
  onToggle,
}: Props) {
  return (
    <div className="bg-pm-purple-bg rounded-xl border border-pm-purple/30 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-pm-purple/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🧠</span>
          <span className="font-semibold text-pm-purple text-sm">Briefing</span>
          {briefing && (
            <span className="text-xs text-text-muted font-mono">
              {new Date(briefing.timestamp).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {briefing && (
            <span
              className={`text-xs font-mono px-2 py-0.5 rounded ${
                briefing.topConvictionTrades?.length ?? 0 > 0
                  ? "bg-pm-purple/20 text-pm-purple"
                  : "bg-surface text-text-muted"
              }`}
            >
              {briefing.topConvictionTrades?.length ?? 0} signals
            </span>
          )}
          <ChevronIcon expanded={expanded} />
        </div>
      </button>

      {/* Content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Loading */}
          {loading && (
            <div className="space-y-2 py-4">
              <div className="skeleton h-4 rounded w-full" />
              <div className="skeleton h-4 rounded w-3/4" />
              <div className="skeleton h-4 rounded w-5/6" />
              <div className="text-xs text-text-muted mt-2">Analyzing...</div>
            </div>
          )}

          {/* No briefing yet */}
          {!briefing && !loading && (
            <div className="text-center py-6">
              <p className="text-sm text-text-muted">
                Click "Briefing" to analyze current signals
              </p>
            </div>
          )}

          {/* Briefing ready */}
          {briefing && !loading && (
            <>
              {/* Summary */}
              {briefing.summary && (
                <div className="bg-pm-purple/10 rounded-lg p-3 border border-pm-purple/20">
                  <p className="text-sm text-text-primary leading-relaxed">
                    {briefing.summary}
                  </p>
                </div>
              )}

              {/* Top conviction trades */}
              {briefing.topConvictionTrades?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-pm-purple">
                    Top Conviction Signals
                  </h4>
                  {briefing.topConvictionTrades.map((trade, i) => (
                    <TradeCard key={i} trade={trade} />
                  ))}
                </div>
              )}

              {/* Quick signals */}
              {briefing.quickSignals?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Quick Signals
                  </h4>
                  <div className="space-y-1">
                    {briefing.quickSignals.map((s, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-pm-purple shrink-0 mt-0.5">•</span>
                        <span className="text-text-secondary">{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risks */}
              {briefing.risks?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-bearish">
                    ⚠️ Risks
                  </h4>
                  <div className="space-y-1">
                    {briefing.risks.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-bearish shrink-0 mt-0.5">!</span>
                        <span className="text-text-secondary">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TradeCard({ trade }: { trade: AIBriefing["topConvictionTrades"][number] }) {
  const convictionColor = {
    high: "text-bullish bg-bullish-bg",
    medium: "text-warning bg-warning-bg",
    low: "text-text-muted bg-surface",
  }[trade.conviction];

  const urgencyLabel =
    trade.urgency_hours < 1
      ? `${Math.round(trade.urgency_hours * 60)}m`
      : trade.urgency_hours < 24
      ? `${Math.round(trade.urgency_hours)}h`
      : `${Math.round(trade.urgency_hours / 24)}d`;

  return (
    <div className="bg-surface rounded-lg p-3 border border-border hover:border-pm-purple/30 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-sm font-medium text-text-primary leading-tight flex-1">
          {trade.market}
        </span>
        <span className={`shrink-0 text-xs font-mono font-semibold px-2 py-0.5 rounded ${convictionColor}`}>
          {trade.odds}
        </span>
      </div>
      <p className="text-xs text-text-secondary mb-2">{trade.reason}</p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted font-mono">
          ⏱ {urgencyLabel}
        </span>
        <span
          className={`text-xs font-semibold ${
            trade.conviction === "high"
              ? "text-bullish"
              : trade.conviction === "medium"
              ? "text-warning"
              : "text-text-muted"
          }`}
        >
          {trade.action}
        </span>
      </div>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
