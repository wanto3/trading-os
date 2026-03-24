// ============================================================
// Crypto Data Fetching — CoinGecko + Coinbase + Fear&Greed
// No Binance dependency
// ============================================================

import type { CryptoPrice, OHLCV, FearGreedData } from "./types";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const COINBASE_API = "https://api.coinbase.com/v2";

// ============================================================
// In-memory cache — prevents rate limiting from free tier
// ============================================================
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttl = CACHE_TTL): void {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// CoinGecko IDs
const COIN_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

const CG_SYMBOL_TO_ID: Record<string, string> = {
  btc: "bitcoin",
  eth: "ethereum",
  sol: "solana",
};

// ============================================================
// Prices
// ============================================================

export async function fetchCryptoPrices(): Promise<CryptoPrice[]> {
  const cached = getCached<CryptoPrice[]>("prices");
  if (cached) return cached;
  try {
    const ids = Object.values(COIN_IDS).join(",");
    const url = `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`CoinGecko price error: ${res.status}`);
    const data = await res.json();

    const result: CryptoPrice[] = Object.entries(COIN_IDS).map(([symbol, id]) => {
      const coin = data[id];
      const price = coin?.usd ?? 0;
      return {
        symbol,
        price,
        change24h: coin?.usd_24h_change ?? 0,
        change1h: 0,
        high24h: price * 1.02,
        low24h: price * 0.98,
        volume24h: 0,
        lastUpdated: new Date((coin?.last_updated_at ?? 0) * 1000).toISOString(),
      } satisfies CryptoPrice;
    });
    setCache("prices", result, 60 * 1000); // 1 min cache
    return result;
  } catch (err) {
    console.error("CoinGecko price fetch failed:", err);
    // Fallback to Coinbase
    return fetchFromCoinbase();
  }
}

async function fetchFromCoinbase(): Promise<CryptoPrice[]> {
  const symbols = ["BTC-USD", "ETH-USD", "SOL-USD"];
  const results: CryptoPrice[] = [];

  for (const pair of symbols) {
    try {
      const res = await fetch(`${COINBASE_API}/prices/${pair}/spot`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json();
      const price = parseFloat(json.data?.amount ?? "0");
      const symbol = pair.replace("-USD", "");
      results.push({
        symbol,
        price,
        change24h: 0,
        change1h: 0,
        high24h: price * 1.02,
        low24h: price * 0.98,
        volume24h: 0,
        lastUpdated: new Date().toISOString(),
      });
    } catch {
      // skip
    }
  }
  return results;
}

// ============================================================
// OHLCV (for RSI, MACD, Bollinger)
// ============================================================

export async function fetchOHLCV(
  coinId: string,
  days = 7
): Promise<OHLCV[]> {
  const cacheKey = `ohlcv_${coinId}_${days}`;
  const cached = getCached<OHLCV[]>(cacheKey);
  if (cached) return cached;

  try {
    const url = `${COINGECKO_API}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    const data: number[][] = await res.json();

    const result: OHLCV[] = data.map((k) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: 0,
      closeTime: k[0] + 3600_000 * (days > 1 ? 1 : 0),
    }));

    // Cache for 10 min — OHLCV doesn't change for historical candles
    setCache(cacheKey, result, 10 * 60 * 1000);
    return result;
  } catch (err) {
    console.error(`CoinGecko OHLCV fetch failed for ${coinId}:`, err);
    return [];
  }
}

// ============================================================
// Fear & Greed Index
// ============================================================

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  const cached = getCached<FearGreedData>("fear_greed");
  if (cached) return cached;
  try {
    const res = await fetch("https://api.alternative.me/fng/", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data?.[0];
    if (!data) return null;

    const value = parseInt(data.value ?? "50");
    const cls = data.value_classification ?? "Neutral";

    const result: FearGreedData = {
      value,
      classification: cls,
      lastUpdated: new Date(parseInt(data.timestamp ?? "0") * 1000).toISOString(),
    };
    setCache("fear_greed", result, 60 * 60 * 1000); // 1 hour
    return result;
  } catch (err) {
    console.error("Fear & Greed fetch failed:", err);
    return null;
  }
}

// ============================================================
// BTC Dominance
// ============================================================

export async function fetchBTCDominance(): Promise<number> {
  const cached = getCached<number>("btc_dominance");
  if (cached !== null) return cached;
  try {
    const res = await fetch(`${COINGECKO_API}/global`, {
      cache: "no-store",
    });
    if (!res.ok) return 50;
    const json = await res.json();
    const result = json.data?.market_cap_percentage?.btc ?? 50;
    setCache("btc_dominance", result, 5 * 60 * 1000);
    return result;
  } catch {
    return 50;
  }
}

// ============================================================
// Funding Rate & Open Interest — Not available from CoinGecko free tier
// ============================================================

export async function fetchFundingRate(_symbol: string) {
  return null; // CoinGecko doesn't expose funding rate on free tier
}

export async function fetchOpenInterest(_symbol: string) {
  return null; // Not available from CoinGecko free tier
}

// ============================================================
// All-in-one fetch
// ============================================================

export async function fetchAllCryptoData() {
  const [prices, fearGreed, btcDom, btcOHLC, ethOHLC, solOHLC] =
    await Promise.all([
      fetchCryptoPrices(),
      fetchFearGreed(),
      fetchBTCDominance(),
      fetchOHLCV("bitcoin", 180),
      fetchOHLCV("ethereum", 180),
      fetchOHLCV("solana", 180),
    ]);

  return {
    prices,
    fearGreed,
    btcDominance: btcDom,
    klines: {
      BTC: btcOHLC,
      ETH: ethOHLC,
      SOL: solOHLC,
    },
  };
}
