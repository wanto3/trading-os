import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get('coin_id');
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 1), 730);
  if (!coinId) { return NextResponse.json({ error: 'coin_id is required' }, { status: 400 }); }

  try {
    // Fetch market chart data (price history) from CoinGecko
    const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }

    const chartData = (await resp.json()) as {
      prices: [number, number][];
      market_caps?: [number, number][];
      total_volumes?: [number, number][];
    };

    // Construct OHLCV candles from price data
    // OHLC format: [timestamp_ms, open, high, low, close, volume]
    const candles: [number, number, number, number, number, number][] = [];

    if (chartData.prices && chartData.prices.length > 0) {
      const prices = chartData.prices;
      const volumes = chartData.total_volumes || [];

      // Group price data by day to form candles
      const dayMap = new Map<string, { open: number; high: number; low: number; close: number; volume: number; ts: number }>();

      for (const [ts, price] of prices) {
        const date = new Date(ts);
        const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        const roundedTs = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());

        if (!dayMap.has(dayKey)) {
          dayMap.set(dayKey, { open: price, high: price, low: price, close: price, volume: 0, ts: roundedTs });
        }
        const day = dayMap.get(dayKey)!;
        day.high = Math.max(day.high, price);
        day.low = Math.min(day.low, price);
        day.close = price;
      }

      // Add volumes
      for (const [ts, vol] of volumes) {
        const date = new Date(ts);
        const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        const day = dayMap.get(dayKey);
        if (day) day.volume += vol;
      }

      // Sort by timestamp and convert to array format
      for (const day of dayMap.values()) {
        candles.push([day.ts, day.open, day.high, day.low, day.close, day.volume]);
      }

      candles.sort((a, b) => a[0] - b[0]);
    }

    return NextResponse.json({ data: candles });
  } catch (err) {
    console.error('Chart data error:', err);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
