import { NextResponse } from 'next/server';

const BINANCE_BASE = 'https://api.binance.com/api/v3';
const SUPPORTED_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

interface BinanceCandle {
  0: number; 1: string; 2: string; 3: string; 4: string; 5: string; 6: number; 7: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol: symbolParam } = await params;
  const { searchParams } = new URL(request.url);

  const rawSymbol = symbolParam.toUpperCase().trim();
  // Support both BTCUSDT and BTC format
  const symbol = rawSymbol.endsWith('USDT') ? rawSymbol : `${rawSymbol}USDT`;

  const interval = searchParams.get('interval') || '1d';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100'), 1), 500);

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  if (!SUPPORTED_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: 'Invalid interval', supported: SUPPORTED_INTERVALS }, { status: 400 });
  }

  try {
    const url = `${BINANCE_BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'Binance API error', status: resp.status }, { status: 502 });
    }

    const data = (await resp.json()) as BinanceCandle[];
    const candles = data.map(c => ({
      symbol,
      interval,
      openTime: c[0],
      closeTime: c[6],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
      quoteVolume: parseFloat(c[7]),
      isClosed: true,
      timestamp: Date.now(),
    }));

    return NextResponse.json({ data: candles, interval, limit });
  } catch (err) {
    console.error('Binance candles API error:', err);
    return NextResponse.json({ error: 'Failed to fetch candle data' }, { status: 500 });
  }
}
