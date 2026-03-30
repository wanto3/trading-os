const cache = new Map<string, { data: unknown; expiry: number }>();

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

export interface OhlcData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface GlobalData {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: { btc: number; eth: number };
    market_cap_change_percentage_24h_usd: number;
  };
}

export function getMarketCoins(page = 1, perPage = 50) {
  return fetchWithCache<CoinMarket[]>(
    `/api/coins?page=${page}&per_page=${perPage}`, 60000
  );
}

export function searchCoins(query: string) {
  return fetchWithCache<{ coins: Array<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }> }>(
    `/api/coingecko/search?q=${encodeURIComponent(query)}`, 60000
  );
}

export function getOhlc(coinId: string, days = 7) {
  // Returns number[][]: [timestamp_ms, open, high, low, close, volume]
  return fetchWithCache<number[][]>(
    `/api/chart-data?coin_id=${encodeURIComponent(coinId)}&days=${days}`, 300000
  );
}

export function getGlobalData() {
  return fetchWithCache<GlobalData>(`/api/coingecko/global`, 300000);
}

export interface ChartPoint {
  time: number;
  value: number;
}

export function getMarketChart(coinId: string, days = 365) {
  return fetchWithCache<{ prices: [number, number][]; market_caps: [number, number][]; total_volumes: [number, number][] }>(
    `/api/chart-data?coin_id=${encodeURIComponent(coinId)}&days=${days}`, 300000
  );
}
