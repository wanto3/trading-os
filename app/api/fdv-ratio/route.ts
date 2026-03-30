import { NextResponse } from "next/server";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 10 * 60 * 1000;
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

export const dynamic = "force-dynamic";

export async function GET() {
  const cached = getCached<unknown>("fdv-ratio");
  if (cached) return NextResponse.json({ data: cached, source: "cache" });

  try {
    // Get top 30 coins by market cap with FDV data
    const res = await fetch(
      `${COINGECKO_API}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=30&page=1&sparkline=false&price_change_percentage=7d`,
      { cache: "no-store" }
    );

    if (!res.ok) throw new Error("CoinGecko rate limited");
    const coins = await res.json();

    const tokens = coins
      .filter((c: Record<string, unknown>) => {
        const mc = (c.market_cap as number) ?? 0;
        const fdv = (c.fully_diluted_valuation as number) ?? 0;
        return mc > 50_000_000 && fdv > 0 && mc > fdv * 0.1;
      })
      .map((c: Record<string, unknown>, i: number) => {
        const mc = c.market_cap as number;
        const fdv = c.fully_diluted_valuation as number;
        const ratio = fdv > 0 ? mc / fdv : 1;
        const circMc = (c.circulating_supply as number) * (c.current_price as number);
        const hiddenSellPressure = fdv - circMc;
        const riskLevel = ratio > 0.5 ? "low" : ratio > 0.2 ? "medium" : "high";

        return {
          id: c.id,
          symbol: (c.symbol as string).toUpperCase(),
          name: c.name as string,
          price: c.current_price as number,
          marketCap: mc,
          fdv,
          circulatingMarketCap: circMc,
          ratio: parseFloat(ratio.toFixed(4)),
          hiddenSellPressure: Math.round(hiddenSellPressure),
          priceChange24h: c.price_change_percentage_24h as number,
          riskLevel,
          rank: i + 1,
        };
      })
      .sort((a: Record<string, number>, b: Record<string, number>) => b.ratio - a.ratio)
      .slice(0, 20);

    // Overall signal
    const lowRiskCount = tokens.filter((t: Record<string, string>) => t.riskLevel === "low").length;
    const highRiskCount = tokens.filter((t: Record<string, string>) => t.riskLevel === "high").length;

    let signal: "buy" | "sell" | "hold" = "hold";
    let signalReason = "Mixed FDV ratios across top tokens";
    if (highRiskCount > 10) { signal = "sell"; signalReason = "Many tokens have extreme FDV dilution — high hidden sell pressure"; }
    else if (lowRiskCount > 15) { signal = "buy"; signalReason = "Most top tokens have low FDV dilution — minimal hidden sell pressure"; }

    const result = {
      tokens,
      signal,
      signalReason,
      highRiskCount,
      timestamp: Date.now(),
    };

    setCache("fdv-ratio", result);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("FDV Ratio API error:", err);
    const result = {
      tokens: [],
      signal: "hold",
      signalReason: "API rate limited — data temporarily unavailable",
      highRiskCount: 0,
      timestamp: Date.now(),
    };
    return NextResponse.json({ data: result });
  }
}
