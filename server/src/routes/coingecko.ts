import { Router } from 'express';
import { get, set } from '../middleware/cache.js';

const router = Router();

const CG_BASE = 'https://api.coingecko.com/api/v3';

// ─── OHLC ─────────────────────────────────────────────────────────────────────
router.get('/coingecko/ohlc', async (req, res) => {
  const coinId = req.query.coin_id as string;
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 7, 1), 365);

  if (!coinId) {
    res.status(400).json({ error: 'coin_id is required' });
    return;
  }

  const cacheKey = `cg:ohlc:${coinId}:${days}`;
  const cached = get<number[][]>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=${days}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }
    const data = (await resp.json()) as number[][];
    set(cacheKey, data, 300);
    res.json({ data });
  } catch (err) {
    console.error('CoinGecko OHLC error:', err);
    res.status(500).json({ error: 'Failed to fetch OHLC data' });
  }
});

// ─── Market coins ─────────────────────────────────────────────────────────────
router.get('/coingecko/market-coins', async (req, res) => {
  const page = Math.min(Math.max(parseInt(req.query.page as string) || 1, 1), 5);
  const perPage = Math.min(Math.max(parseInt(req.query.per_page as string) || 50, 1), 50);

  const cacheKey = `cg:markets:${page}:${perPage}`;
  const cached = get<unknown[]>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }
    const data = (await resp.json()) as unknown[];
    set(cacheKey, data, 60);
    res.json({ data });
  } catch (err) {
    console.error('CoinGecko markets error:', err);
    res.status(500).json({ error: 'Failed to fetch market coins' });
  }
});

// ─── Search ───────────────────────────────────────────────────────────────────
router.get('/coingecko/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query) {
    res.status(400).json({ error: 'q is required' });
    return;
  }

  const cacheKey = `cg:search:${query}`;
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = `${CG_BASE}/search?query=${encodeURIComponent(query)}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }
    const data = (await resp.json()) as unknown;
    set(cacheKey, data, 60);
    res.json({ data });
  } catch (err) {
    console.error('CoinGecko search error:', err);
    res.status(500).json({ error: 'Failed to search coins' });
  }
});

// ─── Global ───────────────────────────────────────────────────────────────────
router.get('/coingecko/global', async (_req, res) => {
  const cacheKey = 'cg:global';
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const resp = await fetch(`${CG_BASE}/global`, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }
    const data = (await resp.json()) as { data: unknown };
    set(cacheKey, data.data, 60);
    res.json({ data: data.data });
  } catch (err) {
    console.error('CoinGecko global error:', err);
    res.status(500).json({ error: 'Failed to fetch global data' });
  }
});

// ─── Market chart ──────────────────────────────────────────────────────────────
router.get('/coingecko/market-chart', async (req, res) => {
  const coinId = req.query.coin_id as string;
  const days = Math.min(Math.max(parseInt(req.query.days as string) || 365, 1), 730);

  if (!coinId) {
    res.status(400).json({ error: 'coin_id is required' });
    return;
  }

  const cacheKey = `cg:market_chart:${coinId}:${days}`;
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: resp.status });
      return;
    }
    const data = (await resp.json()) as unknown;
    set(cacheKey, data, 300);
    res.json({ data });
  } catch (err) {
    console.error('CoinGecko market_chart error:', err);
    res.status(500).json({ error: 'Failed to fetch market chart data' });
  }
});

export default router;
