import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  if (!query) { return NextResponse.json({ error: 'q is required' }, { status: 400 }); }
  try {
    const url = `${CG_BASE}/search?query=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const data = (await resp.json()) as unknown;
    return NextResponse.json({ data });
  } catch (err) {
    console.error('CoinGecko search error:', err);
    return NextResponse.json({ error: 'Failed to search coins' }, { status: 500 });
  }
}
