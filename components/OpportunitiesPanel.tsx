"use client";

import type { PolymarketMarket } from "@/lib/types";

interface Props {
  markets: PolymarketMarket[];
  loading: boolean;
  onRefresh: () => void;
  refreshLoading: boolean;
}

// ============================================================
// Scoring engine — runs client-side on all markets
// Priority: urgency (40%) + volume (30%) + edge from 50/50 (30%)
// ============================================================

interface ScoredMarket {
  market: PolymarketMarket;
  score: number;
  conviction: "high" | "medium" | "low";
  recommendation: "YES" | "NO";
  pct: number;
  edge: string; // how far from 50/50
  reason: string;
  action: string;
}

function scoreMarket(m: PolymarketMarket): ScoredMarket | null {
  const pct = Math.round(parseFloat(m.outcomePrices?.[0] ?? "0.5") * 100);
  const volume = m.volumeNum ?? 0;
  const urgency = m.urgency ?? 999;

  // Skip resolved/closed
  if (m.resolved || m.closed) return null;

  // Skip very low volume (< $1K) — hard to exit
  if (volume < 1000) return null;

  // Skip extremely long tail (> 180 days)
  if (urgency > 180 * 24) return null;

  // ── Conviction ──────────────────────────────────────────
  // "Edge" = how far from 50/50. The closer to 50, the more uncertain
  // which means informed bets have more room to win
  const distFrom50 = Math.abs(pct - 50);
  let conviction: "high" | "medium" | "low";
  let reason: string;
  let action: string;
  let recommendation: "YES" | "NO";

  if (distFrom50 >= 35) {
    conviction = "high";
    reason = pct >= 50
      ? `${pct}% YES — strong consensus, limited upside`
      : `${pct}% YES — heavy NO consensus, high risk`;
    action = pct >= 50
      ? "Consensus trade — monitor for reversal risk"
      : "Contrarian — only if you have information edge";
  } else if (distFrom50 >= 15) {
    conviction = "medium";
    reason = pct >= 50
      ? `${pct}% YES — moderate edge, reasonable trade`
      : `${pct}% YES — underdog with potential value`;
    action = pct >= 50
      ? "Lean YES — odds favor it but stay disciplined"
      : "Lean NO — underdog value, high risk/reward";
  } else {
    conviction = "low";
    reason = `~${pct}% YES — near coinflip, high uncertainty`;
    action = "Skip — no clear edge, coinflip territory";
  }

  // Recs are always the consensus side (if YES%, bet YES; if NO%, bet NO)
  recommendation = pct >= 50 ? "YES" : "NO";

  // ── Composite Score ────────────────────────────────────
  // Urgency (40%): shorter = better (closer to resolution)
  // Volume (30%): higher = better (more liquid)
  // Edge (30%): further from 50 = higher confidence

  // Urgency: log scale, max 168h (1 week) = full score
  const urgencyScore = urgency <= 0 ? 0
    : urgency <= 24 ? 100           // <24h: max urgency
    : urgency <= 168 ? 100 - ((urgency - 24) / (168 - 24)) * 50  // 24h-1w
    : urgency <= 720 ? 50 - ((urgency - 168) / (720 - 168)) * 40  // 1w-30d
    : Math.max(0, 10 - ((urgency - 720) / (4320 - 720)) * 10);  // 30d+

  // Volume: log scale, $1M+ = full score
  const volumeScore = volume < 1000 ? 0
    : Math.min(100, Math.round((Math.log10(volume) - 3) / (6 - 3) * 100));

  // Edge: distance from 50
  const edgeScore = distFrom50 * 2; // 0-50 → 0-100

  const score = urgencyScore * 0.4 + volumeScore * 0.3 + edgeScore * 0.3;

  return {
    market: m,
    score,
    conviction,
    recommendation,
    pct,
    edge: `${distFrom50}pts from 50/50`,
    reason,
    action,
  };
}

// ============================================================
// Urgency buckets
// ============================================================

const TIME_BUCKETS = [
  { label: "< 1d", maxHours: 24, color: "text-bearish", bg: "bg-bearish/10", border: "border-bearish/40", badge: "bg-bearish text-white" },
  { label: "< 1w", maxHours: 200, color: "text-warning", bg: "bg-warning/10", border: "border-warning/40", badge: "bg-warning text-white" },
  { label: "< 2w", maxHours: 350, color: "text-pm-purple", bg: "bg-pm-purple/10", border: "border-pm-purple/40", badge: "bg-pm-purple text-white" },
  { label: "< 1m", maxHours: 750, color: "text-text-secondary", bg: "bg-surface", border: "border-border", badge: "bg-surface text-text-secondary" },
  { label: "1m+", maxHours: Infinity, color: "text-text-muted", bg: "bg-background", border: "border-border", badge: "bg-background text-text-muted" },
] as const;

function getBucket(hours: number) {
  if (hours <= 24) return TIME_BUCKETS[0];
  if (hours <= 200) return TIME_BUCKETS[1];
  if (hours <= 350) return TIME_BUCKETS[2];
  if (hours <= 750) return TIME_BUCKETS[3];
  return TIME_BUCKETS[4];
}

function formatUrgency(hours: number): string {
  if (hours <= 0) return "CLOSING";
  if (hours < 1) return `<${Math.round(hours * 60)}m`;
  if (hours < 24) return `<${Math.round(hours)}h`;
  return `<${Math.round(hours / 24)}d`;
}

// ============================================================
// Component
// ============================================================

export default function OpportunitiesPanel({ markets, loading, onRefresh, refreshLoading }: Props) {
  // Score all markets
  const allScored = markets
    .map(scoreMarket)
    .filter((s): s is ScoredMarket => s !== null)
    .sort((a, b) => {
      // High/medium conviction first, then by score
      if (a.conviction !== b.conviction) {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.conviction] - order[b.conviction];
      }
      return b.score - a.score;
    });

  // Split into urgency buckets
  const buckets = TIME_BUCKETS.map((bucket, i) => {
    const prevMax = i > 0 ? TIME_BUCKETS[i - 1].maxHours : 0;
    return {
      ...bucket,
      trades: allScored.filter(
        (s) => s.market.urgency! > prevMax && s.market.urgency! <= bucket.maxHours
      ),
    };
  }).filter((b) => b.trades.length > 0);

  if (loading) {
    return (
      <section>
        <SectionHeader onRefresh={onRefresh} refreshLoading={refreshLoading} />
        <div className="mt-3 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl p-4 h-40 skeleton" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      <SectionHeader onRefresh={onRefresh} refreshLoading={refreshLoading} />

      {allScored.length === 0 ? (
        <div className="mt-3 bg-surface rounded-xl p-6 text-center">
          <p className="text-sm text-text-muted">No liquid markets found. Check back soon.</p>
        </div>
      ) : (
        <div className="mt-3 space-y-5">
          {buckets.map((bucket) => (
            <div key={bucket.label}>
              {/* Bucket header */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold uppercase tracking-wider ${bucket.color}`}>
                  ⏱ {bucket.label}
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {bucket.trades.length} trade{bucket.trades.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Cards — 2 columns for wide screens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {bucket.trades.slice(0, 6).map((scored) => (
                  <TradeCard key={scored.market.id} scored={scored} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ============================================================
// Trade card
// ============================================================

function TradeCard({ scored }: { scored: ScoredMarket }) {
  const { market, conviction, recommendation, pct, reason, action } = scored;
  const bucket = getBucket(market.urgency ?? 999);
  const urgLabel = formatUrgency(market.urgency ?? 999);
  const vol = market.volumeNum ?? 0;
  const volLabel = vol >= 1_000_000
    ? `$${(vol / 1_000_000).toFixed(1)}M`
    : vol >= 1000
    ? `$${(vol / 1000).toFixed(0)}K`
    : `$${vol}`;

  const pmUrl = `https://polymarket.com/market/${market.slug}`;

  return (
    <a
      href={pmUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`block rounded-xl border p-3 ${bucket.bg} ${bucket.border} transition-all hover:border-pm-purple hover:shadow-lg hover:shadow-pm-purple/20 hover:-translate-y-0.5 cursor-pointer no-underline`}
    >
      {/* External link indicator */}
      <div className="float-right ml-1">
        <span className="text-[10px] text-text-muted">↗</span>
      </div>
      {/* Top row */}
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${conviction === "high" ? "bg-bullish text-white" : conviction === "medium" ? "bg-warning text-white" : "bg-surface text-text-muted"}`}>
              {conviction === "high" ? "HIGH" : conviction === "medium" ? "MED" : "LOW"}
            </span>
            <span className="text-xs font-semibold bg-black/10 text-bullish px-1.5 py-0.5 rounded">
              {recommendation === "YES" ? "✅ YES" : "✅ NO"}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className={`font-mono font-bold text-sm ${pct >= 50 ? "text-bullish" : "text-bearish"}`}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Question */}
      <h4 className="text-xs font-medium text-text-primary leading-tight mb-1 line-clamp-2">
        {market.question}
      </h4>

      {/* YES/NO bar */}
      <div className="flex items-center gap-1 mb-1">
        <span className="text-[10px] font-mono text-bullish w-5">YES</span>
        <div className="flex-1 h-1.5 bg-bearish/30 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-bullish rounded-l-full"
            style={{ width: `${pct}%` }}
          />
          <div
            className="h-full bg-bearish"
            style={{ width: `${100 - pct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-bearish w-5 text-right">NO</span>
      </div>

      {/* Footer: urgency + volume + action */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1">
          <span className={`text-[10px] font-mono ${bucket.color}`}>
            ⏱ {urgLabel}
          </span>
          <span className="text-[10px] text-text-muted font-mono">
            · {volLabel}
          </span>
        </div>
      </div>

      {/* Action */}
      <div className="mt-1 bg-black/5 rounded px-1.5 py-1">
        <p className={`text-[10px] leading-tight ${conviction === "high" ? "text-bullish" : conviction === "medium" ? "text-warning" : "text-text-muted"}`}>
          {action}
        </p>
      </div>
    </a>
  );
}

// ============================================================
// Section header
// ============================================================

function SectionHeader({
  onRefresh,
  refreshLoading,
}: {
  onRefresh: () => void;
  refreshLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-bullish">
          Opportunities
        </span>
        <span className="text-xs font-mono text-text-muted bg-bullish/10 text-bullish px-1.5 py-0.5 rounded">
          Live
        </span>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshLoading}
        className="text-xs text-text-muted hover:text-pm-purple transition-colors disabled:opacity-40 flex items-center gap-1"
      >
        {refreshLoading ? (
          <span className="animate-spin inline-block">↻</span>
        ) : (
          "↻"
        )}
        refresh
      </button>
    </div>
  );
}
