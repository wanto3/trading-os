import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get('coin_id');
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '7'), 1), 365);
  if (!coinId) { return NextResponse.json({ error: 'coin_id is required' }, { status: 400 }); }
  try {
    const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=${days}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const data = (await resp.json()) as Array<[number, number, number, number, number]>;
    return NextResponse.json({ data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    console.error('CoinGecko OHLC error:', err);
    return NextResponse.json({ error: 'Failed to fetch OHLC data' }, { status: 500 });
  }
}