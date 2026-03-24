"use client";

import type { PolymarketMarket } from "@/lib/types";
import { formatUrgency, formatVolume } from "@/lib/polymarket";

interface Props {
  market: PolymarketMarket;
  compact?: boolean;
}

export default function PolymarketCard({ market, compact = false }: Props) {
  const odds = market.outcomePrices?.[0]
    ? Math.round(parseFloat(market.outcomePrices[0]) * 100)
    : 50;
  const yesPrice = parseFloat(market.outcomePrices?.[0] ?? "0.5");
  const noPrice = market.outcomePrices?.[1]
    ? parseFloat(market.outcomePrices[1])
    : 1 - yesPrice;
  const oddsSum = yesPrice + noPrice;

  const urgency = market.urgency ?? 999;
  const isUrgent = urgency < 24;
  const isSoon = urgency < 72;

  const isLowLiquidity = market.liquidityNum < 10000;
  const isHighVolume = market.volumeNum > 500000;

  const borderColor = isUrgent
    ? "border-warning/40"
    : isSoon
    ? "border-border"
    : "border-border";

  return (
    <div
      className={`bg-surface rounded-xl p-4 border ${borderColor} hover:border-pm-purple/40 transition-all duration-200 group ${
        isUrgent ? "glow-purple" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3
          className={`font-medium text-sm leading-tight text-text-primary group-hover:text-pm-purple transition-colors ${
            compact ? "line-clamp-2" : "line-clamp-3"
          }`}
        >
          {market.question}
        </h3>
        {isUrgent && (
          <span className="shrink-0 text-xs font-mono bg-warning/20 text-warning px-1.5 py-0.5 rounded">
            URGENT
          </span>
        )}
      </div>

      {/* Odds row */}
      <div className="flex items-end gap-3 mb-3">
        {/* YES bar */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-text-muted">YES</span>
            <span className="text-xs font-mono font-semibold text-bullish">
              {odds}%
            </span>
          </div>
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                odds >= 60
                  ? "bg-bullish"
                  : odds >= 40
                  ? "bg-warning"
                  : "bg-bearish"
              }`}
              style={{ width: `${odds}%` }}
            />
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          <div className="text-lg font-mono font-bold text-text-primary">
            ${(yesPrice).toFixed(2)}
          </div>
          {oddsSum < 0.98 && (
            <div className="text-xs text-warning font-mono">
              Spread: ${(1 - oddsSum).toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-text-muted">
          {/* Volume */}
          <span
            className={`font-mono ${
              isHighVolume ? "text-bullish" : ""
            }`}
          >
            {formatVolume(market.volumeNum)}
          </span>

          {/* Liquidity */}
          <span
            className={`font-mono ${
              isLowLiquidity ? "text-warning" : ""
            }`}
          >
            Liq: {formatVolume(market.liquidityNum)}
          </span>
        </div>

        {/* Urgency */}
        <span
          className={`text-xs font-mono ${
            isUrgent
              ? "text-warning font-semibold"
              : isSoon
              ? "text-text-secondary"
              : "text-text-muted"
          }`}
        >
          {formatUrgency(urgency)}
        </span>
      </div>
    </div>
  );
}
