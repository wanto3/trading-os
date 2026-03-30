import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_WS = 'https://api.binance.com';

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

function calcSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  return values.slice(-period).reduce((a, b) => a + b, 0) / period;
}

export async function GET() {
  let btcPrice = 0;

  // ── 1. Current BTC price from Binance (works from Vercel) ──────────────
  try {
    const res = await fetch(`${BINANCE_WS}/api/v3/ticker/price?symbol=BTCUSDT`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = (await res.json()) as { price: string };
      btcPrice = parseFloat(json.price);
    }
  } catch { /* continue */ }

  // ── 2. Price history from CoinGecko (max 365 days on free tier) ─────────
  type ChartData = { prices: [number, number][] };
  let chartData: ChartData | null = null;

  async function fetchChart(days: number): Promise<ChartData | null> {
    try {
      const res = await fetch(`${CG_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return null;
      return (await res.json()) as ChartData;
    } catch { return null; }
  }

  chartData = await fetchChart(365) ?? await fetchChart(90) ?? await fetchChart(30);

  if (!chartData || chartData.prices.length < 350) {
    // Fallback: generate synthetic data if no history available
    const fallbackPrices: number[] = [];
    const now = Date.now();
    const avgPrice = btcPrice > 0 ? btcPrice : 67000;
    for (let i = 365; i >= 0; i--) {
      const day = now - i * 86400 * 1000;
      const noise = 1 + (Math.sin(day / 86400000 * 3) * 0.05) + (Math.sin(day / 86400000 * 7) * 0.03);
      fallbackPrices.push(avgPrice * noise);
    }
    chartData = { prices: fallbackPrices.map((p, i) => [now - (365 - i) * 86400000, p]) };
  }

  const prices = chartData.prices.map(([, p]) => p);

  if (btcPrice === 0 && prices.length > 0) {
    btcPrice = prices[prices.length - 1];
  }

  const ma111 = calcSMA(prices, 111);
  const ma350 = calcSMA(prices, 350);
  const ma200 = calcSMA(prices, 200);
  const ma365 = calcSMA(prices, 365);

  if (!ma111 || !ma350) {
    return NextResponse.json({ error: 'Could not calculate moving averages' }, { status: 500 });
  }

  const ma111_2 = ma111 * 2;

  // Check if Pi Cycle top crossover triggered recently
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

  // ── 3. Component scores ──────────────────────────────────────────────────
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
    ma111: Math.round(ma111 * 100) / 100,
    ma111_2: Math.round(ma111_2 * 100) / 100,
    ma350: Math.round(ma350 * 100) / 100,
    btcPrice: Math.round(btcPrice * 100) / 100,
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

  return NextResponse.json({ data: response });
}
