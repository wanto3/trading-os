const CG_BASE = 'https://api.coingecko.com/api/v3';
const cache = new Map<string, { data: unknown; expiry: number }>();

// Generic cache wrapper for any API endpoint
async function fetchWithCache<T>(url: string, cacheMs = 300000): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiry > now) return cached.data as T;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json() as Record<string, unknown>;

  // Handle { data: ... } wrapper and check for error responses
  const data = json.data !== undefined ? json.data : json;
  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error('Empty or invalid response');
  }
  if ((data as Record<string, unknown>).error) {
    throw new Error(`API error: ${(data as Record<string, unknown>).error}`);
  }

  cache.set(url, { data, expiry: now + cacheMs });
  return data as T;
}

// Call CoinGecko API directly (no proxy, avoids Vercel serverless cold start issues)
export async function getMarketCoins(page = 1, perPage = 50): Promise<CoinMarket[]> {
  const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`;
  return fetchWithCache<CoinMarket[]>(url, 60000);
}

// Convert market_chart prices array to OHLCV candles grouped by day
export function pricesToOhlc(prices: [number, number][], volumes?: [number, number][]): number[][] {
  const dayMap = new Map<string, { ts: number; open: number; high: number; low: number; close: number; volume: number }>();

  if (!prices || prices.length === 0) return [];

  for (const [ts, price] of prices) {
    const date = new Date(ts);
    const dayKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
    const volume = volumes?.find(([vts]) => {
      const vd = new Date(vts);
      return vd.getUTCFullYear() === date.getUTCFullYear() &&
        vd.getUTCMonth() === date.getUTCMonth() &&
        vd.getUTCDate() === date.getUTCDate();
    })?.[1] ?? 0;

    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, { ts, open: price, high: price, low: price, close: price, volume });
    } else {
      const day = dayMap.get(dayKey)!;
      day.high = Math.max(day.high, price);
      day.low = Math.min(day.low, price);
      day.close = price;
      day.volume += volume;
    }
  }

  return Array.from(dayMap.values())
    .map(d => [d.ts, d.open, d.high, d.low, d.close, d.volume])
    .sort((a, b) => (a[0] as number) - (b[0] as number));
}

export interface CoinMarket {
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

export interface GlobalData {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

// Call CoinGecko directly for OHLC data
export async function getOhlc(coinId: string, days = 7): Promise<number[][]> {
  const url = `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`;
  const raw = await fetchWithCache<{ prices: [number, number][]; total_volumes?: [number, number][] }>(url, 300000);
  return pricesToOhlc(raw.prices, raw.total_volumes);
}

export function searchCoins(query: string) {
  return fetchWithCache<{ coins: Array<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }> }>(
    `${CG_BASE}/search?query=${encodeURIComponent(query)}`, 60000
  );
}

export function getGlobalData() {
  return fetchWithCache<GlobalData>(`${CG_BASE}/global`, 300000);
}

export interface ChartPoint {
  time: number;
  value: number;
}

// Call CoinGecko directly for market chart data
export function getMarketChart(coinId: string, days = 365) {
  return fetchWithCache<{ prices: [number, number][]; market_caps: [number, number][]; total_volumes: [number, number][] }>(
    `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`,
    300000
  );
}
