import { NextResponse } from "next/server";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 15 * 60 * 1000;

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
  const cached = getCached<unknown>("pi-cycle");
  if (cached) return NextResponse.json({ data: cached, source: "cache" });

  try {
    // Get BTC price + 350-day and 111-day MA data
    const [btcRes, marketRes] = await Promise.all([
      fetch(`${COINGECKO_API}/coins/bitcoin?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=false`, { cache: "no-store" }),
      fetch(`${COINGECKO_API}/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily`, { cache: "no-store" }),
    ]);

    if (!btcRes.ok || !marketRes.ok) throw new Error("CoinGecko rate limited");

    const btcData = await btcRes.json();
    const marketData = await marketRes.json();

    const btcPrice = btcData.market_data?.current_price?.usd ?? 0;
    const prices: number[] = marketData.prices?.map((p: [number, number]) => p[1]) ?? [];

    // Calculate MAs
    const ma350 = prices.slice(-350);
    const ma111 = prices.slice(-111);

    const avg350 = ma350.length > 0 ? ma350.reduce((a: number, b: number) => a + b, 0) / ma350.length : 0;
    const avg111 = ma111.length > 0 ? ma111.reduce((a: number, b: number) => a + b, 0) / ma111.length : 0;

    // Pi Cycle Top: MA111 > MA350 * 2 triggers near market top
    const piCycleTopTriggered = avg111 > avg350 * 2;
    const piCycleTopCrossPrice = piCycleTopTriggered ? btcPrice : null;

    // Composite score: how close are we to the top signal
    // If MA111 is at 50% of MA350*2, that's 50% of the way to a bubble signal
    const maxRatio = 2.0;
    const currentRatio = avg350 > 0 ? avg111 / avg350 : 0;
    const compositeScore = Math.round((currentRatio / maxRatio) * 100);

    let cyclePhase = "early";
    let cyclePhaseLabel = "Early cycle — significant upside remaining";
    let compositeSignal: "buy" | "sell" | "hold" = "buy";
    let compositeSignalLabel = "Early Cycle — Buy";
    let compositeSignalReason = "MA111 well below MA350*2 — early bull phase, strong buy signal";

    if (compositeScore >= 80) {
      cyclePhase = "late";
      cyclePhaseLabel = "Late cycle — approaching bubble zone";
      compositeSignal = "sell";
      compositeSignalLabel = "Warning";
      compositeSignalReason = "MA111 approaching Pi Cycle top signal — bubble zone, take profits";
    } else if (compositeScore >= 60) {
      cyclePhase = "mid";
      cyclePhaseLabel = "Mid-cycle — no extreme reading";
      compositeSignal = "hold";
      compositeSignalLabel = "Hold";
      compositeSignalReason = "Mid-cycle — no extreme reading, stay invested";
    } else if (compositeScore >= 40) {
      cyclePhase = "mid";
      cyclePhaseLabel = "Mid-cycle advance";
      compositeSignal = "hold";
      compositeSignalLabel = "Hold";
      compositeSignalReason = "Bullish but not extreme — hold positions";
    }

    const result = {
      piCycleTopTriggered,
      piCycleTopCrossPrice,
      piCycleTopEstTriggerPrice: avg350 * 2,
      ma111: parseFloat(avg111.toFixed(2)),
      ma111_2: parseFloat((avg350 * 2).toFixed(2)),
      btcPrice,
      compositeScore,
      compositeSignal,
      compositeSignalLabel,
      compositeSignalReason,
      components: [
        { name: "MA 111-day", value: parseFloat(avg111.toFixed(0)), label: `$${Math.round(avg111).toLocaleString()}` },
        { name: "MA 111×2 (top line)", value: parseFloat((avg350 * 2).toFixed(0)), label: `$${Math.round(avg350 * 2).toLocaleString()}` },
      ],
      cyclePhase,
      cyclePhaseLabel,
      timestamp: Date.now(),
    };

    setCache("pi-cycle", result);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("Pi Cycle API error:", err);
    const result = {
      piCycleTopTriggered: false,
      piCycleTopCrossPrice: null,
      piCycleTopEstTriggerPrice: null,
      ma111: 0,
      ma111_2: 0,
      btcPrice: 0,
      compositeScore: 50,
      compositeSignal: "hold",
      compositeSignalLabel: "Hold",
      compositeSignalReason: "API rate limited — insufficient price history for calculation",
      components: [],
      cyclePhase: "mid",
      cyclePhaseLabel: "Mid-cycle — data temporarily unavailable",
      timestamp: Date.now(),
    };
    return NextResponse.json({ data: result });
  }
}
