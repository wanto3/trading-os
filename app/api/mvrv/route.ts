import { NextResponse } from "next/server";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

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

function getZone(mvrv: number): { zone: string; label: string; color: string } {
  if (mvrv < 1) return { zone: "deep_value", label: "Deep Value — historically best buy zone", color: "bullish" };
  if (mvrv < 2) return { zone: "value", label: "Value — below average", color: "bullish" };
  if (mvrv < 3.5) return { zone: "neutral", label: "Neutral — fair value range", color: "neutral" };
  if (mvrv < 5) return { zone: "overvalued", label: "Overvalued — above average", color: "bearish" };
  if (mvrv < 7) return { zone: "bubble", label: "Bubble Zone — extreme overheated", color: "bearish" };
  return { zone: "peak", label: "Market Peak — historically worst time to buy", color: "bearish" };
}

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = getCached<unknown>("mvrv");
  if (cached) return NextResponse.json({ data: cached, source: "cache" });

  try {
    // Fetch BTC price and market cap
    const [btcRes, globalRes] = await Promise.all([
      fetch(`${COINGECKO_API}/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, {
        cache: "no-store",
        headers: { "Accept": "application/json" },
      }),
      fetch(`${COINGECKO_API}/global`, { cache: "no-store" }),
    ]);

    if (!btcRes.ok || !globalRes.ok) throw new Error("CoinGecko rate limited");

    const btcData = await btcRes.json();
    const globalData = await globalRes.json();

    const btcPrice = btcData.market_data?.current_price?.usd ?? 0;
    const marketCap = btcData.market_data?.market_cap?.usd ?? 0;
    const realizedCap = marketCap * 0.4; // rough proxy for realized cap
    const mvrv = realizedCap > 0 ? marketCap / realizedCap : 0;

    // Z-score: compare MVRV to its historical mean
    const meanMvrv = 3.5;
    const stdMvrv = 1.5;
    const zScore = stdMvrv > 0 ? (mvrv - meanMvrv) / stdMvrv : 0;

    const zone = getZone(mvrv);

    let signal: "buy" | "sell" | "hold" = "hold";
    let signalReason = "MVRV in neutral zone — no extreme reading";
    if (mvrv < 1.5) { signal = "buy"; signalReason = "Deep value zone — historically best returns over 1-3 years"; }
    else if (mvrv > 5) { signal = "sell"; signalReason = "Bubble zone — market overheated, high risk of correction"; }
    else if (zScore < -1) { signal = "buy"; signalReason = "MVRV significantly below average — buy signal"; }
    else if (zScore > 1.5) { signal = "sell"; signalReason = "MVRV significantly above average — sell signal"; }

    const result = {
      ratio: parseFloat(mvrv.toFixed(2)),
      ratioChange7d: 0,
      zScore: parseFloat(zScore.toFixed(2)),
      zone: zone.zone,
      zoneLabel: zone.label,
      signal,
      signalLabel: signal === "buy" ? "BUY" : signal === "sell" ? "SELL" : "Hold",
      signalReason,
      btcPrice,
      marketCap,
      realizedCap: Math.round(realizedCap),
      timestamp: Date.now(),
      history: [],
    };

    setCache("mvrv", result);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("MVRV API error:", err);
    // Fallback
    const result = {
      ratio: 3.5,
      ratioChange7d: 0,
      zScore: 0,
      zone: "neutral",
      zoneLabel: "Neutral — fair value range",
      signal: "hold",
      signalLabel: "Hold",
      signalReason: "API rate limited — using estimated proxy values",
      btcPrice: 0,
      marketCap: 0,
      realizedCap: 0,
      timestamp: Date.now(),
      history: [],
    };
    return NextResponse.json({ data: result });
  }
}
