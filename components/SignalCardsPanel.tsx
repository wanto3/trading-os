"use client";

import { useEffect, useState } from "react";
import type {
  SignalCard,
  MvrvData,
  PiCycleData,
  EtfFlowsData,
  FdvRatioData,
  TokenUnlocksData,
} from "@/lib/types";

function cardStyle(level: string) {
  return {
    bullish: { color: "text-bullish", bg: "bg-bullish/10", border: "border-bullish/30", dot: "bg-bullish" },
    bearish: { color: "text-bearish", bg: "bg-bearish/10", border: "border-bearish/30", dot: "bg-bearish" },
    neutral: { color: "text-text-secondary", bg: "bg-surface", border: "border-border", dot: "bg-text-muted" },
    watch: { color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", dot: "bg-warning" },
  }[level] ?? { color: "text-text-secondary", bg: "bg-surface", border: "border-border", dot: "bg-text-muted" };
}

function SignalCardChip({ card }: { card: SignalCard }) {
  const s = cardStyle(card.level);
  return (
    <div className={`rounded-lg border p-3 ${s.bg} ${s.border} flex flex-col gap-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{card.emoji}</span>
          <span className="text-xs font-semibold text-text-primary">{card.name}</span>
        </div>
        <span className={`text-xs font-bold ${s.color}`}>{card.value}</span>
      </div>
      <div className={`text-xs rounded px-2 py-1 ${s.bg} ${s.color}`}>
        {card.plainEnglish}
      </div>
      {card.subValue && (
        <div className="text-xs text-text-muted font-mono">{card.subValue}</div>
      )}
      <div className="text-xs text-text-muted italic">{card.action}</div>
    </div>
  );
}

export default function SignalCardsPanel() {
  const [mvrv, setMvrv] = useState<MvrvData | null>(null);
  const [piCycle, setPiCycle] = useState<PiCycleData | null>(null);
  const [etfFlows, setEtfFlows] = useState<EtfFlowsData | null>(null);
  const [fdvRatio, setFdvRatio] = useState<FdvRatioData | null>(null);
  const [tokenUnlocks, setTokenUnlocks] = useState<TokenUnlocksData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSignals() {
      try {
        const [mvrvRes, piRes, etfRes, fdvRes, unlockRes] = await Promise.all([
          fetch("/api/mvrv"),
          fetch("/api/pi-cycle"),
          fetch("/api/etf-flows"),
          fetch("/api/fdv-ratio"),
          fetch("/api/token-unlocks"),
        ]);
        const [mvrvData, piData, etfData, fdvData, unlockData] = await Promise.all([
          mvrvRes.ok ? mvrvRes.json() : null,
          piRes.ok ? piRes.json() : null,
          etfRes.ok ? etfRes.json() : null,
          fdvRes.ok ? fdvRes.json() : null,
          unlockRes.ok ? unlockRes.json() : null,
        ]);
        setMvrv(mvrvData?.data ?? null);
        setPiCycle(piData?.data ?? null);
        setEtfFlows(etfData?.data ?? null);
        setFdvRatio(fdvData?.data ?? null);
        setTokenUnlocks(unlockData?.data ?? null);
      } catch {
        // non-blocking
      } finally {
        setLoading(false);
      }
    }
    fetchSignals();
  }, []);

  const cards: SignalCard[] = [];

  if (mvrv) {
    const mvrvLevel = mvrv.signal === "buy" ? "bullish" : mvrv.signal === "sell" ? "bearish" : "neutral";
    cards.push({
      id: "mvrv",
      name: "MVRV Z-Score",
      emoji: mvrv.signal === "buy" ? "🛒" : mvrv.signal === "sell" ? "⚠️" : "📊",
      value: mvrv.ratio.toFixed(2),
      subValue: `Z: ${mvrv.zScore.toFixed(2)} — ${mvrv.zoneLabel}`,
      label: mvrv.signalLabel,
      plainEnglish: mvrv.zoneLabel,
      action: mvrv.signalReason,
      level: mvrvLevel,
      color: mvrvLevel === "bullish" ? "text-bullish" : mvrvLevel === "bearish" ? "text-bearish" : "text-text-secondary",
      bgColor: mvrvLevel === "bullish" ? "bg-bullish/10" : mvrvLevel === "bearish" ? "bg-bearish/10" : "bg-surface",
      borderColor: mvrvLevel === "bullish" ? "border-bullish/30" : mvrvLevel === "bearish" ? "border-bearish/30" : "border-border",
    });
  }

  if (piCycle) {
    const piLevel = piCycle.compositeSignal === "buy" ? "bullish" : piCycle.compositeSignal === "sell" ? "bearish" : "neutral";
    cards.push({
      id: "pi-cycle",
      name: "Pi Cycle Top",
      emoji: piLevel === "bullish" ? "🟢" : piLevel === "bearish" ? "🔴" : "⚪",
      value: `${piCycle.compositeScore}/100`,
      subValue: `${piCycle.cyclePhaseLabel}${piCycle.components.length > 0 ? ` — MA111: $${Math.round(piCycle.ma111).toLocaleString()}` : ""}`,
      label: piCycle.compositeSignalLabel,
      plainEnglish: piCycle.cyclePhaseLabel,
      action: piCycle.compositeSignalReason,
      level: piLevel,
      color: piLevel === "bullish" ? "text-bullish" : piLevel === "bearish" ? "text-bearish" : "text-text-secondary",
      bgColor: piLevel === "bullish" ? "bg-bullish/10" : piLevel === "bearish" ? "bg-bearish/10" : "bg-surface",
      borderColor: piLevel === "bullish" ? "border-bullish/30" : piLevel === "bearish" ? "border-bearish/30" : "border-border",
    });
  }

  if (etfFlows) {
    const etfLevel = etfFlows.signal === "bullish" ? "bullish" : etfFlows.signal === "bearish" ? "bearish" : "neutral";
    cards.push({
      id: "etf-flows",
      name: "ETF Flow",
      emoji: etfLevel === "bullish" ? "💰" : etfLevel === "bearish" ? "💸" : "⚖️",
      value: etfFlows.btc.consecutiveInflowDays > 0 ? `+${etfFlows.btc.consecutiveInflowDays}d` : "Outflows",
      subValue: `BTC 7d: ${etfFlows.btcPriceChange24h > 0 ? "+" : ""}${etfFlows.btcPriceChange24h.toFixed(1)}%`,
      label: etfFlows.signalLabel,
      plainEnglish: etfFlows.signalReason,
      action: etfFlows.signalReason,
      level: etfLevel,
      color: etfLevel === "bullish" ? "text-bullish" : etfLevel === "bearish" ? "text-bearish" : "text-text-secondary",
      bgColor: etfLevel === "bullish" ? "bg-bullish/10" : etfLevel === "bearish" ? "bg-bearish/10" : "bg-surface",
      borderColor: etfLevel === "bullish" ? "border-bullish/30" : etfLevel === "bearish" ? "border-bearish/30" : "border-border",
    });
  }

  if (fdvRatio) {
    const fdvLevel = fdvRatio.signal === "buy" ? "bullish" : fdvRatio.signal === "sell" ? "bearish" : "neutral";
    cards.push({
      id: "fdv-ratio",
      name: "FDV Risk",
      emoji: fdvLevel === "bullish" ? "✅" : fdvLevel === "bearish" ? "⚠️" : "⚪",
      value: `${fdvRatio.highRiskCount} high-risk`,
      subValue: `${fdvRatio.tokens.length} tokens scanned`,
      label: fdvRatio.signal === "buy" ? "LOW DILUTION" : fdvRatio.signal === "sell" ? "HIGH DILUTION" : "Mixed",
      plainEnglish: fdvRatio.signalReason,
      action: fdvRatio.signalReason,
      level: fdvLevel,
      color: fdvLevel === "bullish" ? "text-bullish" : fdvLevel === "bearish" ? "text-bearish" : "text-text-secondary",
      bgColor: fdvLevel === "bullish" ? "bg-bullish/10" : fdvLevel === "bearish" ? "bg-bearish/10" : "bg-surface",
      borderColor: fdvLevel === "bullish" ? "border-bullish/30" : fdvLevel === "bearish" ? "border-bearish/30" : "border-border",
    });
  }

  if (tokenUnlocks) {
    const unlockLevel = tokenUnlocks.signal === "sell" ? "bearish" : tokenUnlocks.signal === "buy" ? "bullish" : "neutral";
    cards.push({
      id: "unlocks",
      name: "Unlock Shock",
      emoji: unlockLevel === "bearish" ? "💣" : "📅",
      value: tokenUnlocks.unlocks.length > 0
        ? `$${(tokenUnlocks.totalUpcomingValue / 1e6).toFixed(0)}M`
        : "None",
      subValue: `${tokenUnlocks.unlocks.length} upcoming`,
      label: tokenUnlocks.signalLabel,
      plainEnglish: tokenUnlocks.signalReason,
      action: tokenUnlocks.signalReason,
      level: unlockLevel,
      color: unlockLevel === "bullish" ? "text-bullish" : unlockLevel === "bearish" ? "text-bearish" : "text-text-secondary",
      bgColor: unlockLevel === "bullish" ? "bg-bullish/10" : unlockLevel === "bearish" ? "bg-bearish/10" : "bg-surface",
      borderColor: unlockLevel === "bullish" ? "border-bullish/30" : unlockLevel === "bearish" ? "border-bearish/30" : "border-border",
    });
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-bullish">Alpha Signals</span>
          <span className="text-xs font-mono text-text-muted bg-surface px-1.5 py-0.5 rounded animate-pulse">Loading...</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-surface rounded-xl border border-border h-32 skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-bullish">Alpha Signals</span>
        </div>
        <div className="bg-surface rounded-xl border border-border p-6 text-center">
          <p className="text-sm text-text-muted">Alpha signals loading... Check back in a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-bullish">Alpha Signals</span>
        <span className="text-xs font-mono text-text-muted bg-bullish/10 text-bullish px-1.5 py-0.5 rounded">
          Live
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((card) => (
          <SignalCardChip key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}
