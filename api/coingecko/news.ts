import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CoinGeckoNewsItem {
  id: number;
  title: string;
  description: string;
  author: string;
  url: string;
  news_site: string;
  created_at: number;
  thumb_2x: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const resp = await fetch('https://api.coingecko.com/api/v3/news?page=1', {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }

    const raw = (await resp.json()) as { data: CoinGeckoNewsItem[] };
    res.json({ data: raw.data });
  } catch (err) {
    console.error('CoinGecko news API error:', err);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
