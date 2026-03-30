import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';
const cache = new Map<string, { data: unknown; expires: number }>();
function cacheGet<T>(key: string): T | null { const entry = cache.get(key); if (!entry) return null; if (Date.now() > entry.expires) { cache.delete(key); return null; } return entry.data as T; }
function cacheSet(key: string, data: unknown, ttlSeconds: number) { cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 }); }
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.min(Math.max(parseInt(searchParams.get('page') || '1'), 1), 5);
  const perPage = Math.min(Math.max(parseInt(searchParams.get('per_page') || '50'), 1), 50);
  const cacheKey = `cg:markets:${page}:${perPage}`;
  const cached = cacheGet<unknown[]>(cacheKey);
  if (cached) { return NextResponse.json({ data: cached, _fromCache: true }); }
  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const data = (await resp.json()) as unknown[];
    cacheSet(cacheKey, data, 60);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('CoinGecko markets error:', err);
    return NextResponse.json({ error: 'Failed to fetch market coins' }, { status: 500 });
  }
}
