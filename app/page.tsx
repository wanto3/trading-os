"use client";

import { useEffect, useState, useCallback } from "react";
import PolymarketCard from "@/components/PolymarketCard";
import CryptoPanel from "@/components/CryptoPanel";
import AIBriefingPanel from "@/components/AIBriefingPanel";
import QuickSignals from "@/components/QuickSignals";
import SettingsModal from "@/components/SettingsModal";
import OpportunitiesPanel from "@/components/OpportunitiesPanel";
import SignalCardsPanel from "@/components/SignalCardsPanel";
import FearBanner from "@/components/FearBanner";
import { generateBriefing } from "@/lib/briefing";
import type { CryptoIndicators, PolymarketMarket, AIBriefing } from "@/lib/types";

const REFRESH_INTERVAL = 60_000;

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-bullish live-dot" />
      <span className="text-xs text-text-muted">LIVE</span>
    </span>
  );
}

function formatLastUpdated(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.round((now - d.getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  return `${Math.round(diff / 60)}m ago`;
}

export default function Dashboard() {
  const [crypto, setCrypto] = useState<CryptoIndicators[]>([]);
  const [markets, setMarkets] = useState<PolymarketMarket[]>([]);
  const [briefing, setBriefing] = useState<AIBriefing | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingExpanded, setBriefingExpanded] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cryptoRes, pmRes] = await Promise.all([
        fetch("/api/crypto"),
        fetch("/api/polymarket"),
      ]);

      if (cryptoRes.ok) {
        const cryptoJson = await cryptoRes.json();
        setCrypto(cryptoJson.indicators ?? []);
      }
      if (pmRes.ok) {
        const pmJson = await pmRes.json();
        setMarkets(pmJson.markets ?? []);
      }

      setLastUpdated(new Date().toISOString());
      setError(null);
    } catch {
      setError("Failed to fetch data. Check your internet connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBriefing = useCallback(() => {
    if (crypto.length === 0 || markets.length === 0) return;
    setBriefingLoading(true);
    try {
      const briefing = generateBriefing({
        cryptoIndicators: crypto,
        polymarketMarkets: markets.slice(0, 20),
      });
      setBriefing(briefing);
    } catch {
      // non-blocking
    } finally {
      setBriefingLoading(false);
    }
  }, [crypto, markets]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (crypto.length > 0 && markets.length > 0) {
      fetchBriefing();
    }
  }, [crypto.length, markets.length, fetchBriefing]);

  const urgentMarkets = markets.filter(
    (m) => !m.resolved && !m.closed && (m.urgency ?? 999) < 72
  );
  const trendingMarkets = markets
    .filter((m) => !m.resolved && !m.closed && (m.urgency ?? 999) >= 72)
    .sort((a, b) => b.volumeNum - a.volumeNum)
    .slice(0, 20);

  const quickSignals = buildQuickSignals(crypto, markets, briefing);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight text-text-primary">
            MANAMA
          </h1>
          <span className="text-xs font-mono text-text-muted bg-surface px-2 py-0.5 rounded">
            v0.1
          </span>
          <LiveDot />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBriefing}
            disabled={briefingLoading || crypto.length === 0}
            className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg bg-pm-purple-bg text-pm-purple hover:bg-pm-purple/20 transition-colors disabled:opacity-40"
          >
            {briefingLoading ? (
              <span className="flex items-center gap-1.5">
                <RefreshIcon spinning />
                Analyzing...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <SparkIcon />
                AI Briefing
              </span>
            )}
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg bg-surface hover:bg-surface-hover text-text-secondary transition-colors"
          >
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-4 px-4 py-2 rounded-lg bg-bearish-bg border border-bearish/30 text-bearish text-sm">
          {error}
        </div>
      )}

      <main className="p-4 space-y-4 max-w-[1800px] mx-auto">
        {/* Fear Banner — global market sentiment */}
        <FearBanner />

        <div className="text-xs text-text-muted font-mono">
          Last updated: {formatLastUpdated(lastUpdated)}{" "}
          {loading && <span className="text-warning">(refreshing...)</span>}
        </div>

        {/* Alpha Signals from data engineer */}
        <SignalCardsPanel />

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* LEFT: Opportunities + All Markets */}
          <div className="xl:col-span-7 space-y-4">
            {/* AI-Scored Opportunities */}
            <OpportunitiesPanel
              markets={markets}
              loading={loading}
              onRefresh={fetchBriefing}
              refreshLoading={briefingLoading}
            />

            {/* Browse All Markets */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Browse Markets
                </span>
                <span className="text-xs font-mono text-text-muted">
                  {markets.length} active
                </span>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : trendingMarkets.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {trendingMarkets.slice(0, 8).map((m) => (
                    <PolymarketCard key={m.id} market={m} />
                  ))}
                </div>
              ) : (
                <div className="bg-surface rounded-xl p-8 text-center text-text-muted">
                  No markets found. API may be rate-limited — retry in a moment.
                </div>
              )}
            </section>
          </div>

          {/* RIGHT: Crypto + AI Briefing */}
          <div className="xl:col-span-5 space-y-4">
            <section>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
                  Crypto Overview
                </span>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </div>
              ) : (
                <CryptoPanel indicators={crypto} />
              )}
            </section>

            <AIBriefingPanel
              briefing={briefing}
              loading={briefingLoading}
              expanded={briefingExpanded}
              onToggle={() => setBriefingExpanded(!briefingExpanded)}
            />
          </div>
        </div>

        <QuickSignals signals={quickSignals} />
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

function buildQuickSignals(
  crypto: CryptoIndicators[],
  markets: PolymarketMarket[],
  briefing: AIBriefing | null
) {
  const signals: {
    text: string;
    level: "bullish" | "bearish" | "watch" | "neutral";
    source: string;
  }[] = [];

  for (const ind of crypto) {
    if (ind.rsi.value >= 70) {
      signals.push({
        text: `${ind.symbol} RSI overbought (${ind.rsi.value}) — pullback likely`,
        level: "bearish",
        source: ind.symbol,
      });
    }
    if (ind.rsi.value > 0 && ind.rsi.value <= 30) {
      signals.push({
        text: `${ind.symbol} RSI oversold (${ind.rsi.value}) — potential bounce`,
        level: "bullish",
        source: ind.symbol,
      });
    }
    if (ind.bollinger.position === "squeezed") {
      signals.push({
        text: `${ind.symbol} Bollinger squeeze — big move incoming`,
        level: "watch",
        source: ind.symbol,
      });
    }
    if (ind.macd.crossover === "bullish") {
      signals.push({
        text: `${ind.symbol} MACD bullish crossover`,
        level: "bullish",
        source: ind.symbol,
      });
    }
    if (ind.macd.crossover === "bearish") {
      signals.push({
        text: `${ind.symbol} MACD bearish crossover`,
        level: "bearish",
        source: ind.symbol,
      });
    }
    if (ind.symbol === "BTC" && ind.fearGreed.value >= 75) {
      signals.push({
        text: `Fear & Greed: Extreme Greed (${ind.fearGreed.value})`,
        level: "bearish",
        source: "F&G",
      });
    }
    if (ind.symbol === "BTC" && ind.fearGreed.value <= 25) {
      signals.push({
        text: `Fear & Greed: Extreme Fear — buying zone`,
        level: "bullish",
        source: "F&G",
      });
    }
  }

  const veryUrgent = markets.filter(
    (m) => !m.resolved && (m.urgency ?? 999) < 24 && !m.closed
  );
  if (veryUrgent.length > 0) {
    signals.push({
      text: `${veryUrgent.length} market${veryUrgent.length > 1 ? "s" : ""} resolving in <24h`,
      level: "watch",
      source: "Polymarket",
    });
  }

  if (briefing?.quickSignals?.length) {
    for (const s of briefing.quickSignals.slice(0, 3)) {
      signals.push({ text: s, level: "watch", source: "AI" });
    }
  }

  return signals;
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9.5 9.5 2 12l7.5 2.5L12 22l2.5-7.5L22 12l-7.5-2.5z" />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? "animate-spin" : ""}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function SkeletonCard() {
  return <div className="bg-surface rounded-xl p-4 h-32 skeleton" />;
}
