import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

interface CoinMarket {
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

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.min(Math.max(parseInt(searchParams.get('page') || '1'), 1), 5);
  const perPage = Math.min(Math.max(parseInt(searchParams.get('per_page') || '50'), 1), 50);
  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) { return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 }); }
    const raw = (await resp.json()) as CoinMarket[];
    // Transform to CoinMarket interface
    const data: CoinMarket[] = raw.map(coin => ({
      id: coin.id || '',
      symbol: coin.symbol || '',
      name: coin.name || '',
      image: coin.image || '',
      current_price: coin.current_price ?? 0,
      market_cap: coin.market_cap ?? 0,
      market_cap_rank: coin.market_cap_rank ?? 0,
      price_change_percentage_24h: coin.price_change_percentage_24h ?? 0,
      price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
      sparkline_in_7d: coin.sparkline_in_7d,
      total_volume: coin.total_volume ?? 0,
    }));
    return NextResponse.json({ data });
  } catch (err) {
    console.error('CoinGecko markets error:', err);
    return NextResponse.json({ error: 'Failed to fetch market coins' }, { status: 500 });
  }
}
