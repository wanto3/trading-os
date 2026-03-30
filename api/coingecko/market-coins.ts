import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../cache.js';

interface CoinGeckoMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  sparkline_in_7d?: { price: number[] };
  total_volume: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const page = Math.min(Math.max(parseInt(req.query.page as string) || 1, 1), 5);
  const perPage = Math.min(Math.max(parseInt(req.query.per_page as string) || 50, 1), 50);

  const CACHE_KEY = `coingecko:markets:${page}:${perPage}`;
  const cached = cacheGet<CoinGeckoMarket[]>(CACHE_KEY);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }

    const data = (await resp.json()) as CoinGeckoMarket[];
    cacheSet(CACHE_KEY, data, 60);
    res.json({ data });
  } catch (err) {
    console.error('Market coins API error:', err);
    res.status(500).json({ error: 'Failed to fetch market coins' });
  }
}
