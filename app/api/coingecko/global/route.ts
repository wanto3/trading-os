import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const resp = await fetch(`${CG_BASE}/global`, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const data = (await resp.json()) as { data: unknown };
    return NextResponse.json({ data: data.data });
  } catch (err) {
    console.error('CoinGecko global error:', err);
    return NextResponse.json({ error: 'Failed to fetch global data' }, { status: 500 });
  }
}
