import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../cache.js';

interface CoinGeckoGlobalData {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const CACHE_KEY = 'coingecko:global';
  const cached = cacheGet<CoinGeckoGlobalData>(CACHE_KEY);
  if (cached) {
    res.json({ data: cached.data, _fromCache: true });
    return;
  }

  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/global', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }

    const data = (await resp.json()) as CoinGeckoGlobalData;
    cacheSet(CACHE_KEY, data, 60);
    res.json({ data: data.data });
  } catch (err) {
    console.error('CoinGecko global API error:', err);
    res.status(500).json({ error: 'Failed to fetch global market data' });
  }
}
