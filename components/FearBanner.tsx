"use client";

import { useEffect, useState } from "react";
import type { FearBannerData } from "@/lib/types";

function getFearLevel(value: number): {
  label: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  action: string;
} {
  if (value <= 10) return { label: "Extreme Fear", emoji: "😱", color: "text-bearish", bg: "bg-bearish/10", border: "border-bearish/40", action: "STRONG BUY OPPORTUNITY" };
  if (value <= 25) return { label: "Fear", emoji: "😰", color: "text-bearish", bg: "bg-bearish/5", border: "border-bearish/30", action: "Buy opportunity" };
  if (value <= 45) return { label: "Neutral", emoji: "😐", color: "text-text-secondary", bg: "bg-surface", border: "border-border", action: "Hold" };
  if (value <= 55) return { label: "Neutral", emoji: "🙂", color: "text-text-secondary", bg: "bg-surface", border: "border-border", action: "Hold" };
  if (value <= 75) return { label: "Greed", emoji: "😬", color: "text-bullish", bg: "bg-bullish/5", border: "border-bullish/30", action: "Take profits" };
  return { label: "Extreme Greed", emoji: "😱", color: "text-bullish", bg: "bg-bullish/10", border: "border-bullish/40", action: "STRONG SELL" };
}

export default function FearBanner() {
  const [data, setData] = useState<FearBannerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchFear() {
      try {
        const res = await fetch("https://api.alternative.me/fng/?limit=1");
        if (res.ok) {
          const json = await res.json();
          const item = json.data?.[0];
          if (item) {
            const value = parseInt(item.value ?? "50");
            const cls = item.value_classification ?? "Neutral";
            let signal: "buy" | "sell" | "hold" = "hold";
            let signalReason = "";
            if (value <= 25) { signal = "buy"; signalReason = "Fear-driven selling may be overdone — historically best time to accumulate"; }
            else if (value >= 75) { signal = "sell"; signalReason = "Greed-driven buying may be overdone — historically best time to take profits"; }
            else { signalReason = "No extreme reading"; }
            const actionLabel = signal === "buy" ? "STRONG BUY" : signal === "sell" ? "STRONG SELL" : "Hold";
            setData({ value, classification: cls, action: actionLabel, signal, signalReason });
          }
        }
      } catch {
        // non-blocking
      } finally {
        setLoading(false);
      }
    }
    fetchFear();
  }, []);

  if (loading || !data) return null;

  const level = getFearLevel(data.value);
  const isBuy = data.action === "buy";
  const isSell = data.action === "sell";

  return (
    <div className={`rounded-xl border p-4 ${level.bg} ${level.border}`}>
      <div className="flex items-center gap-3">
        {/* Fear & Greed Gauge */}
        <div className="relative w-16 h-16 shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-border" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={isBuy ? "#22c55e" : isSell ? "#ef4444" : "#71717a"}
              strokeWidth="8"
              strokeDasharray={`${(data.value / 100) * 251.2} 251.2`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-bold font-mono text-text-primary">{data.value}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">{level.emoji}</span>
            <span className={`font-bold text-sm ${level.color}`}>
              {level.label} ({data.value})
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${isBuy ? "bg-bullish text-white" : isSell ? "bg-bearish text-white" : "bg-surface text-text-muted"}`}>
              {level.action}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{data.classification} — {data.signalReason}</p>
        </div>
      </div>
    </div>
  );
}
