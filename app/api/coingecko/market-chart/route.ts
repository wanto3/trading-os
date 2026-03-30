import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const coinId = searchParams.get('coin_id');
  const days = Math.min(Math.max(parseInt(searchParams.get('days') || '365'), 1), 730);
  if (!coinId) { return NextResponse.json({ error: 'coin_id is required' }, { status: 400 }); }
  try {
    const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const data = (await resp.json()) as unknown;
    return NextResponse.json({ data });
  } catch (err) {
    console.error('CoinGecko market_chart error:', err);
    return NextResponse.json({ error: 'Failed to fetch market chart data' }, { status: 500 });
  }
}
