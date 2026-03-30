import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (resp.ok) return resp;
    if (resp.status === 429 || (resp.status >= 502 && resp.status <= 504)) {
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
    return resp;
  }
  throw new Error('Max retries exceeded');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get('coin_id') || searchParams.get('coinId');
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 1), 365);
  if (!coinId) { return NextResponse.json({ error: 'coin_id is required' }, { status: 400 }); }
  try {
    const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const resp = await fetchWithRetry(url);
    if (!resp.ok) {
      const text = await resp.text();
      console.error('CoinGecko OHLC error:', resp.status, text);
      return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 });
    }
    const chartData = (await resp.json()) as { prices: [number, number][]; total_volumes?: [number, number][] };
    // Convert market_chart to OHLCV format
    const dayMap = new Map<string, { ts: number; open: number; high: number; low: number; close: number; volume: number }>();
    for (const [ts, price] of chartData.prices) {
      const date = new Date(ts);
      const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
      const volume = chartData.total_volumes?.find(([vts]) => {
        const vd = new Date(vts);
        return vd.getUTCFullYear() === date.getUTCFullYear() &&
          vd.getUTCMonth() === date.getUTCMonth() &&
          vd.getUTCDate() === date.getUTCDate();
      })?.[1] ?? 0;
      if (!dayMap.has(dayKey)) {
        dayMap.set(dayKey, { ts, open: price, high: price, low: price, close: price, volume });
      } else {
        const day = dayMap.get(dayKey)!;
        day.high = Math.max(day.high, price);
        day.low = Math.min(day.low, price);
        day.close = price;
        day.volume += volume;
      }
    }
    const ohlcv = Array.from(dayMap.values())
      .map(d => [d.ts, d.open, d.high, d.low, d.close, d.volume])
      .sort((a, b) => (a[0] as number) - (b[0] as number));
    return NextResponse.json({ _route: 'app-router-ohlc-v2', data: ohlcv }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    console.error('CoinGecko OHLC error:', err);
    return NextResponse.json({ error: 'Failed to fetch OHLC data' }, { status: 500 });
  }
}
