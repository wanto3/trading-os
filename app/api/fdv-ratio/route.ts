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

const ROUTE_NAME = 'fdv-ratio';
const cache = getRouteCache(ROUTE_NAME);

function cacheGet<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) { cache.delete(key); return null; }
  return entry.data as T;
}
function cacheSet(key: string, data: unknown, ttlSeconds: number) {
  cache.set(key, { data, expires: Date.now() + ttlSeconds * 1000 });
}

function getRiskLevel(ratio: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (ratio < 3) return 'low';
  if (ratio < 5) return 'medium';
  if (ratio < 10) return 'high';
  return 'extreme';
}

export async function GET() {
  const cacheKey = 'api:fdv-ratio';
  const cached = cacheGet<unknown>(cacheKey);
  if (cached) {
    return NextResponse.json({ data: cached, _fromCache: true });
  }

  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h&sparkline=false`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 });
    }

    const data = (await resp.json()) as Array<{
      id: string; symbol: string; name: string; current_price: number;
      market_cap: number; fully_diluted_valuation: number | null;
      circulating_supply: number; total_supply: number | null;
      price_change_percentage_24h: number;
    }>;

    const stablecoins = ['usdt', 'usdc', 'dai', 'frax', 'busd', 'gusd', 'husd', 'susd'];
    const tokens: Array<{
      id: string; symbol: string; name: string; price: number;
      marketCap: number; fdv: number; circulatingMarketCap: number;
      ratio: number; hiddenSellPressure: number; priceChange24h: number;
      riskLevel: 'low' | 'medium' | 'high' | 'extreme'; rank: number;
    }> = [];

    for (const coin of data) {
      if (!coin.current_price || !coin.circulating_supply) continue;
      if (stablecoins.includes(coin.id)) continue;

      const price = coin.current_price;
      const fdv = coin.fully_diluted_valuation ?? (coin.total_supply ?? coin.circulating_supply) * price;
      const circMarketCap = coin.circulating_supply * price;

      if (fdv <= 0 || circMarketCap <= 0) continue;
      const ratio = fdv / circMarketCap;
      if (ratio < 1.01) continue;
      if (circMarketCap < 1e6) continue;

      tokens.push({
        id: coin.id,
        symbol: coin.symbol.toUpperCase(),
        name: coin.name,
        price,
        marketCap: coin.market_cap,
        fdv,
        circulatingMarketCap: circMarketCap,
        ratio,
        hiddenSellPressure: fdv - circMarketCap,
        priceChange24h: coin.price_change_percentage_24h ?? 0,
        riskLevel: getRiskLevel(ratio),
        rank: coin.market_cap > 0 ? Math.round(Math.log10(coin.market_cap)) : 0,
      });
    }

    tokens.sort((a, b) => b.ratio - a.ratio);
    const ranked = tokens.slice(0, 20).map((t, i) => ({ ...t, rank: i + 1 }));

    const highRiskCount = ranked.filter(t => t.riskLevel === 'high' || t.riskLevel === 'extreme').length;
    const avgRatio = ranked.length > 0 ? ranked.reduce((s, t) => s + t.ratio, 0) / ranked.length : 1;

    let signal: 'buy' | 'sell' | 'hold' = 'hold';
    let signalReason = 'FDV ratios within normal range';
    if (highRiskCount >= 5 && avgRatio > 5) {
      signal = 'sell';
      signalReason = `${highRiskCount} tokens with >5x FDV/circulating ratio — elevated hidden sell pressure across top tokens`;
    } else if (highRiskCount >= 3) {
      signalReason = `${highRiskCount} tokens flagged for high FDV dilution risk`;
    } else if (highRiskCount === 0 && avgRatio < 3) {
      signal = 'buy';
      signalReason = 'Most top tokens have low FDV dilution — minimal hidden sell pressure';
    }

    const response = { tokens: ranked, signal, signalReason, highRiskCount, timestamp: Date.now() };
    cacheSet(cacheKey, response, 3600);
    return NextResponse.json({ data: response });
  } catch (err) {
    console.error('FDV ratio API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
