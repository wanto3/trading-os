import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from '../cache.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const q = req.query.q as string;

  if (!q || q.trim().length === 0) {
    res.json({ data: { coins: [] } });
    return;
  }

  const query = q.trim();
  const CACHE_KEY = `coingecko:search:${query.toLowerCase()}`;
  const cached = cacheGet<unknown>(CACHE_KEY);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }

    const data = await resp.json();
    cacheSet(CACHE_KEY, data, 60);
    res.json({ data });
  } catch (err) {
    console.error('Search API error:', err);
    res.status(500).json({ error: 'Failed to search coins' });
  }
}
