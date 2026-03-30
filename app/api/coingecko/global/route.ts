import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

function getRouteCache(routeName: string) {
  if (!globalThis.__routeCaches) {
    globalThis.__routeCaches = new Map<string, Map<string, { data: unknown; expires: number }>>();
  }
  if (!globalThis.__routeCaches.has(routeName)) {
    globalThis.__routeCaches.set(routeName, new Map());
  }
  return globalThis.__routeCaches.get(routeName)!;
}

const ROUTE_NAME = 'coingecko-global';
const cache = getRouteCache(ROUTE_NAME);

function cacheGet<T>(key: string): T | null { const entry = cache.get(key); if (!entry) return null; if (Date.now() > entry.expires) { cache.delete(key); return null; } return entry.data as T; }
function cacheSet(key: string, data: unknown, ttlSeconds: number) { cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 }); }
export async function GET() {
  const cacheKey = 'api:cg:global';
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) { return NextResponse.json({ data: cached, _fromCache: true }); }
  try {
    const resp = await fetch(`${CG_BASE}/global`, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const data = (await resp.json()) as { data: unknown };
    cacheSet(cacheKey, data.data, 60);
    return NextResponse.json({ data: data.data });
  } catch (err) {
    console.error('CoinGecko global error:', err);
    return NextResponse.json({ error: 'Failed to fetch global data' }, { status: 500 });
  }
}
