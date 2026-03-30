import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';

interface ComponentScore {
  name: string;
  value: number;
  score: number;
  status: 'bullish' | 'bearish' | 'neutral';
}

interface PiCycleResponse {
  piCycleTopTriggered: boolean;
  piCycleTopCrossPrice: number | null;
  piCycleTopEstTriggerPrice: number | null;
  ma111: number;
  ma111_2: number;
  ma350: number;
  btcPrice: number;
  compositeScore: number;
  compositeSignal: 'buy' | 'hold' | 'sell';
  compositeSignalLabel: string;
  compositeSignalReason: string;
  components: ComponentScore[];
  cyclePhase: 'early' | 'mid' | 'late' | 'peak';
  cyclePhaseLabel: string;
  timestamp: number;
}

function getRouteCache(routeName: string) {
  if (!globalThis.__routeCaches) {
    globalThis.__routeCaches = new Map<string, Map<string, { data: unknown; expires: number }>>();
  }
  if (!globalThis.__routeCaches.has(routeName)) {
    globalThis.__routeCaches.set(routeName, new Map());
  }
  return globalThis.__routeCaches.get(routeName)!;
}

const ROUTE_NAME = 'pi-cycle';
const cache = getRouteCache(ROUTE_NAME);

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data as T;
}
function cacheSet(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

function calcSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export async function GET() {
  const cacheKey = 'api:pi-cycle';
  const cached = cacheGet<PiCycleResponse>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, _fromCache: true });
  }

  try {
    const [histRes, priceRes] = await Promise.all([
      fetch(`${CG_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=400&interval=daily`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${CG_BASE}/simple/price?ids=bitcoin&vs_currency=usd`, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (!histRes.ok) {
      return NextResponse.json({ error: 'CoinGecko API error', status: histRes.status }, { status: 502 });
    }

    const histData = (await histRes.json()) as { prices: [number, number][] };
    const prices = histData.prices.map(([, p]) => p);

    if (prices.length < 350) {
      return NextResponse.json({ error: 'Insufficient price history' }, { status: 502 });
    }

    let currentPrice = prices[prices.length - 1];
    if (priceRes.ok) {
      const priceData = (await priceRes.json()) as Record<string, { usd: number }>;
      currentPrice = priceData.bitcoin?.usd ?? currentPrice;
    }

    const ma111 = calcSMA(prices, 111);
    const ma350 = calcSMA(prices, 350);
    const ma200 = calcSMA(prices, 200);
    const ma365 = calcSMA(prices, 365);

    if (!ma111 || !ma350) {
      return NextResponse.json({ error: 'Could not calculate moving averages' }, { status: 500 });
    }

    const ma111_2 = ma111 * 2;
    const btcPrice = currentPrice;

    let triggered = false;
    let crossPrice: number | null = null;
    const recentPrices = prices.slice(-30);
    for (let i = 1; i < recentPrices.length; i++) {
      const sliceBefore = prices.slice(0, prices.length - 30 + i);
      const sliceAfter = prices.slice(0, prices.length - 30 + i + 1);
      if (sliceBefore.length < 350 || sliceAfter.length < 350) continue;
      const ma111b = calcSMA(sliceBefore, 111);
      const ma111a = calcSMA(sliceAfter, 111);
      const ma350b = calcSMA(sliceBefore, 350);
      const ma350a = calcSMA(sliceAfter, 350);
      if (!ma111b || !ma111a || !ma350b || !ma350a) continue;
      if (ma111b * 2 <= ma350b && ma111a * 2 > ma350a) {
        triggered = true;
        crossPrice = prices[prices.length - 30 + i];
        break;
      }
    }

    let estTriggerPrice: number | null = null;
    if (!triggered && ma111_2 < ma350) {
      estTriggerPrice = Math.round(btcPrice * (ma350 / ma111_2));
    }

    const mayerMultiple = ma200 ? btcPrice / ma200 : 1;
    const mayerScore = Math.min(100, Math.max(0,
      mayerMultiple <= 0.5 ? 5 : mayerMultiple >= 3.5 ? 95 :
      Math.round(((mayerMultiple - 0.5) / 3.0) * 100)
    ));
    const mayerStatus = mayerMultiple < 1 ? 'bullish' : mayerMultiple > 2.5 ? 'bearish' : 'neutral';

    const mvrvProxy = ma365 ? btcPrice / ma365 : 1;
    const mvrvScore = Math.min(100, Math.max(0, Math.round(((mvrvProxy - 0.5) / 8) * 100 + 10)));
    const mvrvStatus = mvrvProxy < 2 ? 'bullish' : mvrvProxy > 5 ? 'bearish' : 'neutral';

    const puellProxy = ma365 ? btcPrice / ma365 : 1;
    const puellScore = Math.min(100, Math.max(0, Math.round(((puellProxy - 0.5) / 3.0) * 100)));
    const puellStatus = puellProxy < 1 ? 'bullish' : puellProxy > 2 ? 'bearish' : 'neutral';

    const grRatio = btcPrice / (ma350 * 1.618);
    const grScore = Math.min(100, Math.max(0,
      grRatio < 0.5 ? 10 : grRatio > 2.0 ? 90 :
      Math.round(((grRatio - 0.5) / 1.5) * 80 + 10)
    ));
    const grStatus = grRatio < 0.8 ? 'bullish' : grRatio > 1.5 ? 'bearish' : 'neutral';

    const compositeScore = Math.round(mvrvScore * 0.3 + puellScore * 0.25 + mayerScore * 0.25 + grScore * 0.2);

    const cyclePhase = compositeScore > 75 ? 'peak' : compositeScore > 65 ? 'late' : compositeScore < 25 ? 'early' : 'mid';
    const cyclePhaseLabel = cyclePhase === 'peak' ? 'Peak zone — historically 2-4 weeks from local top'
      : cyclePhase === 'late' ? 'Late cycle — approaching overheated territory'
      : cyclePhase === 'early' ? 'Early cycle — accumulation zone'
      : 'Mid-cycle — normal market conditions';

    const compositeSignal = compositeScore < 25 ? 'buy'
      : compositeScore > 65 ? 'sell' : 'hold';
    const compositeSignalLabel = compositeScore < 25 ? 'Strong Buy'
      : compositeScore > 65 ? 'Sell Risk'
      : compositeScore > 50 ? 'Hold + Caution' : 'Hold';
    const compositeSignalReason = compositeScore < 25
      ? 'Composite score below 25 — historically strong accumulation zone'
      : compositeScore > 65
      ? 'Composite score above 65 — cycle top zone, reduce risk'
      : compositeScore > 50
      ? 'Composite score elevated — monitoring for top signals'
      : 'Composite cycle score in neutral range';

    const response: PiCycleResponse = {
      piCycleTopTriggered: triggered,
      piCycleTopCrossPrice: crossPrice,
      piCycleTopEstTriggerPrice: estTriggerPrice,
      ma111,
      ma111_2,
      ma350,
      btcPrice,
      compositeScore,
      compositeSignal,
      compositeSignalLabel,
      compositeSignalReason,
      components: [
        { name: 'MVRV', value: Math.round(mvrvProxy * 100) / 100, score: mvrvScore, status: mvrvStatus },
        { name: 'Puell Multiple', value: Math.round(puellProxy * 100) / 100, score: puellScore, status: puellStatus },
        { name: 'Mayer Multiple', value: Math.round(mayerMultiple * 100) / 100, score: mayerScore, status: mayerStatus },
        { name: 'Golden Ratio', value: Math.round(grRatio * 100) / 100, score: grScore, status: grStatus },
      ],
      cyclePhase,
      cyclePhaseLabel,
      timestamp: Date.now(),
    };

    cacheSet(cacheKey, response, 3600);
    return NextResponse.json({ data: response });
  } catch (err) {
    console.error('Pi Cycle error:', err);
    return NextResponse.json({ error: 'Failed to fetch Pi Cycle data' }, { status: 500 });
  }
}
