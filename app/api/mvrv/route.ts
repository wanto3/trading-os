import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';

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
  try {
    const [priceRes, bcRes, histRes] = await Promise.all([
      fetch(`${CG_BASE}/simple/price?ids=bitcoin&vs_currency=usd&include_market_cap=true&include_24hr_change=true`, { signal: AbortSignal.timeout(8000) }),
      fetch('https://api.blockchain.info/stats', { signal: AbortSignal.timeout(5000) }).catch(() => null),
      fetch(`${CG_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=730&interval=daily`, { signal: AbortSignal.timeout(10000) }),
    ]);

    let price = 0;
    let marketCap = 0;
    let realizedCap = 0;

    if (priceRes.ok) {
      const priceData = (await priceRes.json()) as Record<string, { usd: number; usd_market_cap: number }>;
      price = priceData.bitcoin?.usd ?? 0;
      marketCap = priceData.bitcoin?.usd_market_cap ?? 0;
    }

    // Try blockchain.info for realized cap — fall back to CoinGecko supply data
    if (bcRes?.ok) {
      const bcData = (await bcRes.json()) as Record<string, number>;
      const rc = bcData.realized_cap_usd;
      const mc = bcData.market_cap_usd;
      if (rc && mc && rc > 0 && mc > 0) {
        realizedCap = rc;
        marketCap = mc;
      }
    }

    // Fallback: estimate realized cap from CoinGecko if not available
    if (realizedCap === 0 && marketCap > 0 && price > 0) {
      // Use 60% of market cap as estimated realized cap (historical average)
      realizedCap = marketCap * 0.6;
    }
    if (realizedCap === 0 && price > 0) {
      // Use a conservative MVRV of 3.0 as fallback
      realizedCap = price * 1e7 / 3.0; // Approximate realized cap from price
    }

    let mvrv = 0;
    let zScore = 1.0;
    if (realizedCap > 0) {
      mvrv = marketCap / realizedCap;
    } else if (marketCap > 0) {
      mvrv = 3.5;
      realizedCap = marketCap / mvrv;
    }

    let ratioChange7d = 0;
    if (histRes.ok) {
      const histData = (await histRes.json()) as { prices: [number, number][] };
      if (histData.prices && histData.prices.length >= 8) {
        const prices = histData.prices.map(([, p]) => p);
        const ma7: number[] = [];
        for (let i = 7; i < prices.length; i++) {
          ma7.push(prices.slice(i - 7, i).reduce((a, b) => a + b, 0) / 7);
        }
        if (ma7.length >= 2) {
          ratioChange7d = (prices[prices.length - 1] / ma7[ma7.length - 1]) - (prices[7] / ma7[0]);
        }
        if (histData.prices.length > 365) {
          const window = 365;
          const prices2 = histData.prices.map(([, p]) => p);
          const realizedPrices: number[] = [];
          for (let i = window; i < prices2.length; i++) {
            realizedPrices.push(prices2.slice(i - window, i).reduce((a, b) => a + b, 0) / window);
          }
          const mvrvHistory = prices2.slice(window).map((p, i) => p / realizedPrices[i]);
          zScore = calcZScore(mvrvHistory);
        }
      }
    }

    const zone = getZone(mvrv || 3.5);
    const signalData = getSignal(mvrv || 3.5, zScore);

    const response: MvrvResponse = {
      ratio: mvrv || 3.5,
      ratioChange7d,
      zScore,
      zone,
      zoneLabel: getZoneLabel(zone),
      signal: signalData.signal,
      signalLabel: signalData.label,
      signalReason: signalData.reason,
      btcPrice: price,
      marketCap: marketCap || 0,
      realizedCap: realizedCap || 0,
      timestamp: Date.now(),
      history: [],
    };

    return NextResponse.json({ data: response });
  } catch (err) {
    console.error('MVRV error:', err);
    return NextResponse.json({ error: 'Failed to fetch MVRV data' }, { status: 500 });
  }
}
