// ============================================================
// Polymarket Data Fetching via Gamma REST API
// ============================================================

import type { PolymarketMarket } from "./types";

const GAMMA_API = "https://gamma-api.polymarket.com";

interface GammaMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string;
  outcomePrices: string;
  volume: string;
  liquidity: string;
  volumeNum: number;
  liquidityNum: number;
  endDate: string;
  closed: boolean;
  resolved: boolean;
  oneDayPriceChange?: number;
  oneHourPriceChange?: number;
}

interface GammaResponse extends Array<GammaMarket> {}

// Cache
let _cache: {
  data: PolymarketMarket[] | null;
  timestamp: number;
} = { data: null, timestamp: 0 };
const CACHE_TTL = 60_000; // 60 seconds

function computeUrgency(endDateStr: string): number {
  const end = new Date(endDateStr).getTime();
  const now = Date.now();
  return Math.max(0, (end - now) / (1000 * 60 * 60));
}

function gammaToMarket(gm: GammaMarket): PolymarketMarket {
  let outcomePrices: string[] = [];
  try {
    outcomePrices = JSON.parse(gm.outcomePrices ?? "[]");
  } catch {
    outcomePrices = [];
  }

  const urgency = computeUrgency(gm.endDate);
  const yesPrice = parseFloat(outcomePrices[0] ?? "0.5");

  return {
    id: gm.id,
    question: gm.question,
    slug: gm.slug,
    description: "",
    outcomes: [],
    outcomePrices,
    volume: parseFloat(gm.volume) || 0,
    liquidity: parseFloat(gm.liquidity) || 0,
    volumeNum: gm.volumeNum ?? 0,
    liquidityNum: gm.liquidityNum ?? 0,
    startDate: "",
    endDate: gm.endDate,
    resolved: gm.resolved ?? false,
    closed: gm.closed ?? false,
    urgency,
    volumeSurge: (gm.volumeNum ?? 0) > 500_000,
    oddsChange1h: gm.oneHourPriceChange,
    oddsChange24h: gm.oneDayPriceChange,
  };
}

export async function fetchPolymarketMarkets(): Promise<PolymarketMarket[]> {
  // Return cached if fresh
  if (_cache.data && Date.now() - _cache.timestamp < CACHE_TTL) {
    return _cache.data!;
  }

  try {
    // Fetch ALL active markets (not filtering by closed= param since it's a string "false" in the API)
    // Sort by urgency ascending — urgency wins for finding short-term trades
    const params = new URLSearchParams({
      closed: "false",
      limit: "500",
      orderBy: "volume",
    });

    const res = await fetch(`${GAMMA_API}/markets?${params}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Gamma API error: ${res.status}`);
    }

    const data: GammaResponse = await res.json();

    const markets = data
      .filter((m) => {
        // Gamma returns closed/resolved as string "false" or "true"
        const isResolved = m.resolved === true || m.resolved === "true";
        const isClosed = m.closed === true || m.closed === "true";
        const urg = computeUrgency(m.endDate);
        return !isResolved && !isClosed && urg > 0;
      })
      .map(gammaToMarket)
      .sort((a, b) => (a.urgency ?? 999) - (b.urgency ?? 999));

    _cache = { data: markets, timestamp: Date.now() };
    return markets;
  } catch (err) {
    console.error("Polymarket fetch error:", err);
    if (_cache.data) return _cache.data;
    return [];
  }
}

export function formatUrgency(hours: number): string {
  if (hours <= 0) return "RESOLVING";
  if (hours < 1) return `${Math.round(hours * 60)}m left`;
  if (hours < 24) return `${Math.round(hours)}h left`;
  if (hours < 24 * 7) return `${Math.round(hours / 24)}d left`;
  return `${Math.round(hours / (24 * 7))}w left`;
}

export function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `$${(vol / 1_000).toFixed(0)}K`;
  return `$${vol.toFixed(0)}`;
}
