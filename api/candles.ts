import type { VercelRequest, VercelResponse } from '@vercel/node';
import { cacheGet, cacheSet } from './cache.js';

const BINANCE_BASE = 'https://api.binance.com/api/v3';

const SUPPORTED_INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];

interface BinanceCandle {
  0: number;  // open time
  1: string;  // open
  2: string;  // high
  3: string;  // low
  4: string;  // close
  5: string;  // volume
  6: number;  // close time
  7: string;  // quote volume
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { symbol, interval = '1d', limit = '100' } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ error: 'symbol is required' });
    return;
  }

  const normalizedSymbol = symbol.toUpperCase().replace(/USDT$/, '').replace(/[^A-Z]/g, '');
  if (!normalizedSymbol) {
    res.status(400).json({ error: 'Invalid symbol' });
    return;
  }

  const pair = `${normalizedSymbol}USDT`;
  const safeInterval = SUPPORTED_INTERVALS.includes(interval as string) ? (interval as string) : '1d';
  const safeLimit = Math.min(Math.max(parseInt(limit as string) || 100, 1), 500);

  // Check cache (5 minute TTL)
  const cacheKey = `vercel:candles:${pair}:${safeInterval}:${safeLimit}`;
  const cached = cacheGet<BinanceCandle[]>(cacheKey);
  if (cached) {
    res.json({ data: cached, cached: true });
    return;
  }

  try {
    const url = `${BINANCE_BASE}/klines?symbol=${pair}&interval=${safeInterval}&limit=${safeLimit}`;
    const resp = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      res.status(502).json({ error: 'Binance API error', status: resp.status });
      return;
    }

    const data = (await resp.json()) as BinanceCandle[];
    const candles = data.map(c => ({
      symbol: normalizedSymbol,
      interval: safeInterval,
      openTime: c[0],
      closeTime: c[6],
      open: parseFloat(c[1]),
      high: parseFloat(c[2]),
      low: parseFloat(c[3]),
      close: parseFloat(c[4]),
      volume: parseFloat(c[5]),
      quoteVolume: parseFloat(c[7]),
      isClosed: true,
      timestamp: Date.now(),
    }));

    cacheSet(cacheKey, candles, 300);
    res.json({ data: candles });
  } catch (err) {
    console.error('Binance candles API error:', err);
    res.status(500).json({ error: 'Failed to fetch candle data' });
  }
}
