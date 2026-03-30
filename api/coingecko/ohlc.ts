import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const coinId = req.query.coin_id as string;
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);

  if (!coinId) {
    res.status(400).json({ error: 'coin_id is required' });
    return;
  }

  try {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=${days}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }

    const data = (await resp.json()) as number[][];
    res.json({ data });
  } catch (err) {
    console.error('CoinGecko OHLC API error:', err);
    res.status(500).json({ error: 'Failed to fetch OHLC data' });
  }
}
