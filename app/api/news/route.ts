import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const cache = new Map<string, { data: unknown; expires: number }>();

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data as T;
}
function cacheSet(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

export async function GET() {
  const cacheKey = 'api:news';
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, _fromCache: true });
  }

  try {
    const resp = await fetch(`${CG_BASE}/news?page=1`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 });
    }

    const data = await resp.json() as { data: unknown };
    cacheSet(cacheKey, data.data, 300);
    return NextResponse.json({ data });
  } catch (err) {
    console.error('CoinGecko news API error:', err);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 500 });
  }
}
