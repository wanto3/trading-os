// Call backend proxy routes which bypass CORS (server-to-server)
const API_BASE = '';

const cache = new Map<string, { data: unknown; expiry: number }>();

// Generic cache wrapper for any API endpoint with retry logic
async function fetchWithCache<T>(url: string, cacheMs = 300000, retries = 2): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiry > now) return cached.data as T;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
          continue;
        }
        throw new Error(`API error: ${res.status}`);
      }
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
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError || new Error('Fetch failed');
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

// Proxy through backend route (bypasses CORS since it's server-side)
export async function getMarketCoins(page = 1, perPage = 50): Promise<CoinMarket[]> {
  const url = `${API_BASE}/api/coingecko/market-coins?page=${page}&per_page=${perPage}`;
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

// Proxy through backend OHLC route
export async function getOhlc(coinId: string, days = 7): Promise<number[][]> {
  const url = `${API_BASE}/api/coingecko/ohlc?coin_id=${encodeURIComponent(coinId)}&days=${days}`;
  // The backend returns { _route: ..., data: [[ts, open, high, low, close, volume], ...] }
  const raw = await fetchWithCache<number[][]>(url, 300000);
  return raw;
}

export function searchCoins(query: string) {
  return fetchWithCache<{ coins: Array<{ id: string; name: string; symbol: string; thumb: string; market_cap_rank: number }> }>(
    `${API_BASE}/api/coingecko/search?q=${encodeURIComponent(query)}`, 60000
  );
}

export function getGlobalData() {
  return fetchWithCache<GlobalData>(`${API_BASE}/api/coingecko/global`, 300000);
}

export interface ChartPoint {
  time: number;
  value: number;
}

// Proxy through backend route
export function getMarketChart(coinId: string, days = 365) {
  return fetchWithCache<{ prices: [number, number][]; market_caps: [number, number][]; total_volumes: [number, number][] }>(
    `${API_BASE}/api/coingecko/market-chart?coin_id=${encodeURIComponent(coinId)}&days=${days}`,
    300000
  );
}
