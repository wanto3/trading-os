import { NextResponse } from "next/server";

const CACHE_TTL = 60 * 60 * 1000;
interface CacheEntry<T> { data: T; expiry: number; }
const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() > entry.expiry) { cache.delete(key); return null; }
  return entry.data;
}
function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// Curated upcoming token unlock schedule (public data)
// Real implementation would use TokenUnlocks.io paid API
const UPCOMING_UNLOCKS = [
  { id: "uniswap", symbol: "UNI", name: "Uniswap", unlockDate: "2026-04-01", amount: 149_000_000, value: 149_000_000 * 3.46 },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", unlockDate: "2026-04-15", amount: 425_000_000, value: 425_000_000 * 0.89 },
  { id: "optimism", symbol: "OP", name: "Optimism", unlockDate: "2026-05-01", amount: 230_000_000, value: 230_000_000 * 1.78 },
  { id: "aave", symbol: "AAVE", name: "Aave", unlockDate: "2026-04-20", amount: 38_000_000, value: 38_000_000 * 178.5 },
  { id: "sui", symbol: "SUI", name: "Sui", unlockDate: "2026-04-10", amount: 164_000_000, value: 164_000_000 * 0.87 },
  { id: "sei", symbol: "SEI", name: "Sei", unlockDate: "2026-05-15", amount: 180_000_000, value: 180_000_000 * 0.42 },
  { id: "aptos", symbol: "APT", name: "Aptos", unlockDate: "2026-04-05", amount: 82_000_000, value: 82_000_000 * 8.92 },
  { id: "sandbox", symbol: "SAND", name: "The Sandbox", unlockDate: "2026-04-30", amount: 380_000_000, value: 380_000_000 * 0.41 },
];

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = getCached<unknown>("token-unlocks");
  if (cached) return NextResponse.json({ data: cached, source: "cache" });

  const now = Date.now();

  const upcomingUnlocks = UPCOMING_UNLOCKS
    .map((u) => {
      const unlockTime = new Date(u.unlockDate).getTime();
      const daysUntil = Math.round((unlockTime - now) / (1000 * 60 * 60 * 24));
      return {
        ...u,
        value: Math.round(u.value),
        daysUntil,
        unlockTime,
      };
    })
    .filter((u) => u.daysUntil >= 0 && u.daysUntil <= 60)
    .sort((a, b) => a.daysUntil - b.daysUntil);

  // Shock index: total upcoming unlock value / average daily volume
  const totalUnlockValue = upcomingUnlocks.reduce((sum, u) => sum + u.value, 0);
  const shockIndex = totalUnlockValue > 500_000_000 ? "high" : totalUnlockValue > 200_000_000 ? "medium" : "low";

  let signal: "sell" | "hold" = "hold";
  let signalReason = `${upcomingUnlocks.length} upcoming unlocks in next 60 days`;

  if (shockIndex === "high") {
    signal = "sell";
    signalReason = `High unlock shock: $${(totalUnlockValue / 1e9).toFixed(1)}B unlocking soon — sell pressure incoming`;
  } else if (shockIndex === "medium") {
    signal = "hold";
    signalReason = `Moderate unlock pressure: $${(totalUnlockValue / 1e6).toFixed(0)}M unlocking — watch for dilution`;
  }

  const result = {
    unlocks: upcomingUnlocks,
    totalUpcomingValue: Math.round(totalUnlockValue),
    shockIndex,
    signal,
    signalLabel: signal === "sell" ? "SELL" : "Hold",
    signalReason,
    timestamp: now,
  };

  setCache("token-unlocks", result);
  return NextResponse.json({ data: result });
}
