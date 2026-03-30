const cache = new Map<string, { data: unknown; expiry: number }>();

const CG_BASE = 'https://api.coingecko.com/api/v3';

async function fetchWithCache<T>(url: string, cacheMs = 300000): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiry > now) return cached.data as T;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  // Proxy responses wrap data in { data: ... }; direct responses return data directly
  const json = await res.json() as Record<string, unknown>;
  const data = json.data !== undefined ? json.data : json;
  cache.set(url, { data, expiry: now + cacheMs });
  return data as T;
}

// Convert market_chart prices array to OHLCV candles grouped by day
export function pricesToOhlc(prices: [number, number][], volumes?: [number, number][]): number[][] {
  const dayMap = new Map<string, { ts: number; open: number; high: number; low: number; close: number; volume: number }>();

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

// Call CoinGecko directly for market coins (bypasses broken backend routes)
export function getMarketCoins(page = 1, perPage = 50) {
  return fetchWithCache<CoinMarket[]>(
    `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`,
    60000
  );
}

export function searchCoins(query: string) {
  return fetchWithCache<{ coins: Array<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }> }>(
    `/api/coingecko/search?q=${encodeURIComponent(query)}`, 60000
  );
}

// Returns [timestamp_ms, open, high, low, close, volume][] - calls CoinGecko directly
export async function getOhlc(coinId: string, days = 7): Promise<number[][]> {
  const chartData = await fetchWithCache<{ prices: [number, number][]; market_caps?: [number, number][]; total_volumes?: [number, number][] }>(
    `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}&interval=daily`,
    300000
  );
  return pricesToOhlc(chartData.prices, chartData.total_volumes);
}

export function getGlobalData() {
  return fetchWithCache<GlobalData>(`/api/coingecko/global`, 300000);
}

export interface ChartPoint {
  time: number;
  value: number;
}

// Returns raw market_chart data (prices, market_caps, total_volumes)
export function getMarketChart(coinId: string, days = 365) {
  return fetchWithCache<{ prices: [number, number][]; market_caps: [number, number][]; total_volumes: [number, number][] }>(
    `${CG_BASE}/coins/${encodeURIComponent(coinId)}/market_chart?vs_currency=usd&days=${days}`,
    300000
  );
}
