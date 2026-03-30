import { NextResponse } from 'next/server';

export interface ExchangeFundingRate {
  exchange: string;
  symbol: string;
  ratePer8h: number;       // as decimal, e.g. 0.0001 = 0.01% per 8h
  apr: number;            // annualized percentage rate
  nextFundingTime: string | null;
  status: 'normal' | 'warning' | 'extreme';
  lastUpdated: string;
}

export interface FundingRatesResponse {
  data: ExchangeFundingRate[];
  averageApr: number;
  timestamp: number;
}

function getStatus(ratePer8h: number): 'normal' | 'warning' | 'extreme' {
  const absRate = Math.abs(ratePer8h);
  if (absRate > 0.001) return 'extreme';    // > 0.1% per 8h
  if (absRate > 0.0005) return 'warning';   // > 0.05% per 8h
  return 'normal';
}

async function fetchBinance(): Promise<ExchangeFundingRate | null> {
  try {
    const res = await fetch(
      'https://fapi.binance.com/fapi/v1/fundingRate?limit=1',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json() as Array<{
      symbol: string;
      fundingRate: string;
      nextFundingTime: number;
    }>;
    const btc = data.find(d => d.symbol === 'BTCUSDT');
    if (!btc) return null;
    const rate = parseFloat(btc.fundingRate);
    return {
      exchange: 'Binance',
      symbol: 'BTCUSDT',
      ratePer8h: rate,
      apr: rate * 3 * 365 * 100,  // 3 funding periods per day
      nextFundingTime: new Date(btc.nextFundingTime).toISOString(),
      status: getStatus(rate),
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchBybit(): Promise<ExchangeFundingRate | null> {
  try {
    const res = await fetch(
      'https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { retCode: number; data: { list: Array<{ fundingRate: string; nextFundingTime: string }> } };
    const item = json.data?.list?.[0];
    if (!item) return null;
    const rate = parseFloat(item.fundingRate);
    return {
      exchange: 'Bybit',
      symbol: 'BTCUSDT',
      ratePer8h: rate,
      apr: rate * 3 * 365 * 100,
      nextFundingTime: item.nextFundingTime ? new Date(parseInt(item.nextFundingTime)).toISOString() : null,
      status: getStatus(rate),
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchOkx(): Promise<ExchangeFundingRate | null> {
  try {
    const res = await fetch(
      'https://www.okx.com/api/v5/market/funding-rate?instId=BTC-USDT-SWAP',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { data: Array<{ fundingRate: string; nextFundingTime: string }> };
    const item = json.data?.[0];
    if (!item) return null;
    const rate = parseFloat(item.fundingRate);
    return {
      exchange: 'OKX',
      symbol: 'BTC-USDT-SWAP',
      ratePer8h: rate,
      apr: rate * 3 * 365 * 100,
      nextFundingTime: item.nextFundingTime ? new Date(parseInt(item.nextFundingTime)).toISOString() : null,
      status: getStatus(rate),
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchDeribit(): Promise<ExchangeFundingRate | null> {
  try {
    const res = await fetch(
      'https://www.deribit.com/api/v2/public/get_funding_rate?currency=BTC',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { result: { funding_rate: number; next_funding_time: number } };
    const rate = json.result?.funding_rate ?? 0;
    return {
      exchange: 'Deribit',
      symbol: 'BTC-PERPETUAL',
      ratePer8h: rate,
      apr: rate * 3 * 365 * 100,
      nextFundingTime: json.result?.next_funding_time
        ? new Date(json.result.next_funding_time).toISOString()
        : null,
      status: getStatus(rate),
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchDydx(): Promise<ExchangeFundingRate | null> {
  try {
    const res = await fetch(
      'https://api.dydx.exchange/v4/markets/BTC-USD',
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json() as { markets: { nextFundingRate: string; nextFundingTime: string } };
    const market = json.markets;
    if (!market) return null;
    const rate = parseFloat(market.nextFundingRate ?? '0');
    return {
      exchange: 'dYdX',
      symbol: 'BTC-USD',
      ratePer8h: rate,
      apr: rate * 3 * 365 * 100,
      nextFundingTime: market.nextFundingTime
        ? new Date(parseInt(market.nextFundingTime)).toISOString()
        : null,
      status: getStatus(rate),
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const results = await Promise.allSettled([
      fetchBinance(),
      fetchBybit(),
      fetchOkx(),
      fetchDeribit(),
      fetchDydx(),
    ]);

    const rates: ExchangeFundingRate[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        rates.push(result.value);
      }
    }

    if (rates.length === 0) {
      return NextResponse.json({ error: 'No funding rate data available' }, { status: 503 });
    }

    const averageApr = rates.reduce((sum, r) => sum + r.apr, 0) / rates.length;
    const response: FundingRatesResponse = {
      data: rates,
      averageApr,
      timestamp: Date.now(),
    };

    return NextResponse.json({ data: rates, averageApr, timestamp: response.timestamp });
  } catch (err) {
    console.error('Funding rates API error:', err);
    return NextResponse.json({ error: 'Failed to fetch funding rates' }, { status: 500 });
  }
}
