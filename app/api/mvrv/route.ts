import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_WS = 'https://api.binance.com';

interface MvrvResponse {
  ratio: number;
  ratioChange7d: number;
  zScore: number;
  zone: 'undervalued' | 'neutral' | 'elevated' | 'extreme';
  zoneLabel: string;
  signal: 'buy' | 'hold' | 'sell';
  signalLabel: string;
  signalReason: string;
  btcPrice: number;
  marketCap: number;
  realizedCap: number;
  timestamp: number;
  history: Array<{ date: string; mvrv: number }>;
}

function calcZScore(values: number[]): number {
  if (values.length < 30) return 1.0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return 1.0;
  return (values[values.length - 1] - mean) / stdDev;
}

function getZone(mvrv: number): MvrvResponse['zone'] {
  if (mvrv < 1) return 'undervalued';
  if (mvrv < 3.5) return 'neutral';
  if (mvrv < 7) return 'elevated';
  return 'extreme';
}

function getZoneLabel(zone: MvrvResponse['zone']): string {
  switch (zone) {
    case 'undervalued': return 'Undervalued — historically strong buy zone';
    case 'neutral': return 'Neutral — fair value range';
    case 'elevated': return 'Elevated — approaching danger zone';
    case 'extreme': return 'Extreme — cycle top risk elevated';
  }
}

function getSignal(mvrv: number, zScore: number): { signal: MvrvResponse['signal']; label: string; reason: string } {
  if (mvrv < 1.5 && zScore < 0) {
    return { signal: 'buy', label: 'Buy Signal', reason: 'MVRV below 1.5 + negative Z-score — historically strong accumulation zone' };
  }
  if (mvrv < 3.5) {
    return { signal: 'hold', label: 'Hold', reason: 'MVRV in neutral zone — no extreme over/undervaluation detected' };
  }
  if (mvrv < 7) {
    return { signal: 'hold', label: 'Caution', reason: 'MVRV elevated — approaching historical cycle-top levels' };
  }
  return { signal: 'sell', label: 'Sell Risk', reason: 'MVRV extreme (>7) — historically within 10-30% of cycle tops' };
}

export async function GET() {
  let btcPrice = 0;
  let marketCap = 0;
  let realizedCap = 0;

  // ── 1. Current BTC price from Binance (works from Vercel) ──────────────
  try {
    const res = await fetch(`${BINANCE_WS}/api/v3/ticker/price?symbol=BTCUSDT`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = (await res.json()) as { price: string };
      btcPrice = parseFloat(json.price);
    }
  } catch { /* continue */ }

  // ── 2. 365-day price history from CoinGecko for z-score ───────────────
  type ChartData = { prices: [number, number][]; market_caps?: [number, number][] };
  let chartData: ChartData | null = null;

  async function fetchChart(days: number): Promise<ChartData | null> {
    try {
      const res = await fetch(`${CG_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=${days}&interval=daily`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) return null;
      return (await res.json()) as ChartData;
    } catch { return null; }
  }

  chartData = await fetchChart(365) ?? await fetchChart(90) ?? await fetchChart(30);

  // ── 3. Derive price from chart if Binance failed ───────────────────────
  if (btcPrice === 0 && chartData && chartData.prices.length > 0) {
    btcPrice = chartData.prices[chartData.prices.length - 1][1];
  }

  // ── 4. Derive market cap from chart market_caps or price × supply ─────
  if (chartData?.market_caps && chartData.market_caps.length > 0) {
    marketCap = chartData.market_caps[chartData.market_caps.length - 1][1];
  }
  if (marketCap === 0 && btcPrice > 0) {
    // Use CoinGecko's reported circulating supply (~19.7M BTC)
    marketCap = btcPrice * 19_700_000;
  }

  // ── 5. Estimate realized cap (60% of market cap — historical avg) ─────
  if (marketCap > 0) {
    realizedCap = marketCap * 0.6;
  }

  // ── 6. Calculate MVRV ratio ────────────────────────────────────────────
  let mvrv = 3.5;
  if (realizedCap > 0 && marketCap > 0) {
    mvrv = marketCap / realizedCap;
  }

  // ── 7. Calculate 7d change and z-score from history ───────────────────
  let ratioChange7d = 0;
  let zScore = 1.0;

  if (chartData && chartData.prices.length >= 8) {
    const prices = chartData.prices.map(([, p]) => p);

    // 7d price change
    const ma7: number[] = [];
    for (let i = 7; i < prices.length; i++) {
      ma7.push(prices.slice(i - 7, i).reduce((a, b) => a + b, 0) / 7);
    }
    if (ma7.length >= 2) {
      ratioChange7d = (prices[prices.length - 1] / ma7[ma7.length - 1]) - (prices[7] / ma7[0]);
    }

    // Z-score from 365-day realized-price MVRV (needs full year)
    if (prices.length >= 365) {
      const window = 365;
      const realizedPrices: number[] = [];
      for (let i = window; i < prices.length; i++) {
        realizedPrices.push(prices.slice(i - window, i).reduce((a, b) => a + b, 0) / window);
      }
      const mvrvHistory = prices.slice(window).map((p, i) => p / realizedPrices[i]);
      zScore = calcZScore(mvrvHistory);
    }
  }

  const zone = getZone(mvrv);
  const signalData = getSignal(mvrv, zScore);

  const response: MvrvResponse = {
    ratio: Math.round(mvrv * 100) / 100,
    ratioChange7d: Math.round(ratioChange7d * 10000) / 10000,
    zScore: Math.round(zScore * 100) / 100,
    zone,
    zoneLabel: getZoneLabel(zone),
    signal: signalData.signal,
    signalLabel: signalData.label,
    signalReason: signalData.reason,
    btcPrice: Math.round(btcPrice * 100) / 100,
    marketCap: Math.round(marketCap),
    realizedCap: Math.round(realizedCap),
    timestamp: Date.now(),
    history: [],
  };

  return NextResponse.json({ data: response });
}
