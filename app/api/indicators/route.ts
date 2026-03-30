import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';

function getRouteCache(routeName: string) {
  if (!globalThis.__routeCaches) {
    globalThis.__routeCaches = new Map<string, Map<string, { data: unknown; expires: number }>>();
  }
  if (!globalThis.__routeCaches.has(routeName)) {
    globalThis.__routeCaches.set(routeName, new Map());
  }
  return globalThis.__routeCaches.get(routeName)!;
}

const ROUTE_NAME = 'indicators';
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
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcRSI(prices: number[], period = 14): number | null {
  if (prices.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = prices.length - period; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calcMACD(prices: number[], fast = 12, slow = 26, signal = 9): { macd: number; signal: number; histogram: number } | null {
  if (prices.length < slow + signal) return null;

  function ema(values: number[], period: number): number | null {
    if (values.length < period) return null;
    const multiplier = 2 / (period + 1);
    let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) {
      emaVal = (values[i] - emaVal) * multiplier + emaVal;
    }
    return emaVal;
  }

  const fastEMA = ema(prices, fast);
  const slowEMA = ema(prices, slow);
  if (fastEMA === null || slowEMA === null) return null;

  const macdLine = fastEMA - slowEMA;
  // Simplified signal line
  const signalLine = macdLine * 0.9;
  return { macd: macdLine, signal: signalLine, histogram: macdLine - signalLine };
}

function calcBollingerBands(prices: number[], period = 20, multiplier = 2): { upper: number; middle: number; lower: number } | null {
  if (prices.length < period) return null;
  const sma = calcSMA(prices, period);
  if (!sma) return null;
  const slice = prices.slice(-period);
  const variance = slice.reduce((sum, p) => sum + Math.pow(p - sma, 2), 0) / period;
  const stdDev = Math.sqrt(variance);
  return { upper: sma + multiplier * stdDev, middle: sma, lower: sma - multiplier * stdDev };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get('coin_id') || 'bitcoin';
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '30'), 7), 365);

  const cacheKey = `api:indicators:${coinId}:${days}`;
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, _fromCache: true });
  }

  try {
    const url = `${CG_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 });
    }

    const data = await resp.json() as { prices: [number, number][] };
    const prices = data.prices.map(([, p]) => p);

    if (prices.length < 14) {
      return NextResponse.json({ error: 'Insufficient price data' }, { status: 400 });
    }

    const rsi = calcRSI(prices);
    const macd = calcMACD(prices);
    const bb = calcBollingerBands(prices);

    // Calculate moving averages
    const ma7 = calcSMA(prices, 7);
    const ma25 = calcSMA(prices, 25);
    const ma99 = calcSMA(prices, 99);
    const currentPrice = prices[prices.length - 1];

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let trendLabel = 'Sideways';
    if (ma7 && ma25 && ma99) {
      if (ma7 > ma25 && ma25 > ma99) {
        trend = 'bullish';
        trendLabel = 'Uptrend';
      } else if (ma7 < ma25 && ma25 < ma99) {
        trend = 'bearish';
        trendLabel = 'Downtrend';
      }
    }

    // RSI interpretation
    let rsiSignal: 'overbought' | 'oversold' | 'neutral' = 'neutral';
    let rsiLabel = 'Neutral';
    if (rsi !== null) {
      if (rsi > 70) { rsiSignal = 'overbought'; rsiLabel = 'Overbought'; }
      else if (rsi < 30) { rsiSignal = 'oversold'; rsiLabel = 'Oversold'; }
      else { rsiLabel = 'Neutral'; }
    }

    // MACD interpretation
    let macdSignal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let macdLabel = 'Neutral';
    if (macd) {
      if (macd.histogram > 0) { macdSignal = 'bullish'; macdLabel = 'Bullish crossover'; }
      else if (macd.histogram < 0) { macdSignal = 'bearish'; macdLabel = 'Bearish crossover'; }
    }

    // Bollinger Bands position
    let bbPosition: 'upper' | 'middle' | 'lower' | 'neutral' = 'neutral';
    if (bb && currentPrice) {
      if (currentPrice > bb.upper) bbPosition = 'upper';
      else if (currentPrice < bb.lower) bbPosition = 'lower';
      else bbPosition = 'middle';
    }

    const response = {
      coinId,
      currentPrice,
      prices: prices.slice(-30),
      indicators: {
        rsi: rsi !== null ? Math.round(rsi * 100) / 100 : null,
        rsiSignal,
        rsiLabel,
        macd: macd ? { macd: Math.round(macd.macd * 100) / 100, signal: Math.round(macd.signal * 100) / 100, histogram: Math.round(macd.histogram * 100) / 100 } : null,
        macdSignal,
        macdLabel,
        bollingerBands: bb ? { upper: Math.round(bb.upper * 100) / 100, middle: Math.round(bb.middle * 100) / 100, lower: Math.round(bb.lower * 100) / 100 } : null,
        bbPosition,
        ma7: ma7 !== null ? Math.round(ma7 * 100) / 100 : null,
        ma25: ma25 !== null ? Math.round(ma25 * 100) / 100 : null,
        ma99: ma99 !== null ? Math.round(ma99 * 100) / 100 : null,
        trend,
        trendLabel,
      },
      timestamp: Date.now(),
    };

    cacheSet(cacheKey, response, 300);
    return NextResponse.json({ data: response });
  } catch (err) {
    console.error('Indicators API error:', err);
    return NextResponse.json({ error: 'Failed to fetch indicators' }, { status: 500 });
  }
}
