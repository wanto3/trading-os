"use client";

import type { CryptoIndicators, IndicatorSignal } from "@/lib/types";

interface Props {
  indicators: CryptoIndicators[];
}

export default function CryptoPanel({ indicators }: Props) {
  return (
    <div className="space-y-3">
      {indicators.map((ind) => (
        <CoinCard key={ind.symbol} ind={ind} />
      ))}
    </div>
  );
}

function CoinCard({ ind }: { ind: CryptoIndicators }) {
  const { symbol, price, rsi, macd, bollinger, fearGreed, fundingRate } = ind;

  const priceColor =
    price.change24h > 0
      ? "text-bullish"
      : price.change24h < 0
      ? "text-bearish"
      : "text-text-primary";

  return (
    <div className="bg-surface rounded-xl border border-border p-4 space-y-3">
      {/* Coin header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CoinIcon symbol={symbol} />
          <div>
            <span className="font-semibold text-text-primary">{symbol}</span>
            <span className="text-xs text-text-muted ml-1">/USDT</span>
          </div>
        </div>
        <div className="text-right">
          <div className={`font-mono font-bold text-lg ${priceColor}`}>
            ${symbol === "BTC" ? price.price.toLocaleString(undefined, { maximumFractionDigits: 0 }) : price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs font-mono ${priceColor}`}>
            {price.change24h > 0 ? "+" : ""}
            {price.change24h.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Signals grid */}
      <div className="grid grid-cols-2 gap-2">
        <SignalChip signal={rsi.signal} />
        <SignalChip signal={macd.signal} />
        <SignalChip signal={bollinger.signal} />

        {/* Fear & Greed only for BTC */}
        {symbol === "BTC" && fearGreed && (
          <SignalChip
            signal={{
              name: "Fear & Greed",
              value: fearGreed.value,
              plainEnglish: `${fearGreed.value} — ${fearGreed.classification}`,
              action:
                fearGreed.value >= 75
                  ? "Consider taking profits"
                  : fearGreed.value <= 25
                  ? "Potential buying opportunity"
                  : "No extreme reading",
              level:
                fearGreed.value >= 75
                  ? "bearish"
                  : fearGreed.value <= 25
                  ? "bullish"
                  : "neutral",
              emoji:
                fearGreed.value >= 75
                  ? "😱"
                  : fearGreed.value <= 25
                  ? "🛒"
                  : "😐",
            }}
          />
        )}

        {/* VWAP */}
        <SignalChip signal={ind.vwap.signal} />

        {/* SMA 200 */}
        <SignalChip signal={ind.sma200.signal} />

        {/* Funding rate */}
        {fundingRate && (
          <SignalChip
            signal={{
              name: `${symbol} Funding`,
              value: `${fundingRate.rate.toFixed(3)}%`,
              plainEnglish:
                fundingRate.rate > 0
                  ? "Longs paying shorts"
                  : "Shorts paying longs",
              action:
                fundingRate.rate > 0.1
                  ? "High squeeze risk on longs"
                  : fundingRate.rate < -0.1
                  ? "Short squeeze risk"
                  : "Normal funding",
              level:
                fundingRate.rate > 0.1
                  ? "bearish"
                  : fundingRate.rate < -0.1
                  ? "bullish"
                  : "neutral",
              emoji: fundingRate.rate > 0 ? "🔴" : fundingRate.rate < 0 ? "🟢" : "⚪",
            }}
          />
        )}
      </div>
    </div>
  );
}

function SignalChip({ signal }: { signal: IndicatorSignal }) {
  const bgClass = {
    bullish: "bg-bullish-bg border-bullish/30",
    bearish: "bg-bearish-bg border-bearish/30",
    watch: "bg-warning-bg border-warning/30",
    neutral: "bg-surface border-border",
  }[signal.level];

  const textClass = {
    bullish: "text-bullish",
    bearish: "text-bearish",
    watch: "text-warning",
    neutral: "text-text-secondary",
  }[signal.level];

  const actionBgClass = {
    bullish: "bg-bullish/10",
    bearish: "bg-bearish/10",
    watch: "bg-warning/10",
    neutral: "bg-muted/20",
  }[signal.level];

  return (
    <div
      className={`rounded-lg border p-2 ${bgClass} flex flex-col gap-1`}
      title={`${signal.name}: ${signal.plainEnglish}\n\n${signal.action}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-text-muted truncate">{signal.name}</span>
        <span className="text-base">{signal.emoji}</span>
      </div>
      <div className="font-mono font-semibold text-sm text-text-primary truncate">
        {typeof signal.value === "number" ? signal.value : signal.value}
      </div>
      <div className={`text-xs rounded px-1.5 py-1 ${actionBgClass} ${textClass}`}>
        {signal.plainEnglish}
      </div>
    </div>
  );
}

function CoinIcon({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    BTC: "#F7931A",
    ETH: "#627EEA",
    SOL: "#9945FF",
  };
  const color = colors[symbol] ?? "#71717a";

  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
      style={{ backgroundColor: color + "33", border: `1.5px solid ${color}` }}
    >
      {symbol.slice(0, 1)}
    </div>
  );
}
