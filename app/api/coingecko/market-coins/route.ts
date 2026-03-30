import { NextResponse } from 'next/server';
const CG_BASE = 'https://api.coingecko.com/api/v3';

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (resp.ok) return resp;
    // Retry on rate limit (429) or server error (502, 503, 504)
    if (resp.status === 429 || (resp.status >= 502 && resp.status <= 504)) {
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
    return resp;
  }
  throw new Error('Max retries exceeded');
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.min(Math.max(parseInt(searchParams.get('page') || '1'), 1), 5);
  const perPage = Math.min(Math.max(parseInt(searchParams.get('per_page') || '50'), 1), 50);
  try {
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true&price_change_percentage=7d`;
    const resp = await fetchWithRetry(url);
    if (!resp.ok) {
      const text = await resp.text();
      console.error('CoinGecko markets error:', resp.status, text);
      return NextResponse.json({ error: 'CoinGecko API error', status: resp.status }, { status: 502 });
    }
    const data = (await resp.json()) as unknown[];
    return NextResponse.json({ _route: 'app-router-market-coins-v2', data }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err) {
    console.error('CoinGecko markets error:', err);
    return NextResponse.json({ error: 'Failed to fetch market coins' }, { status: 500 });
  }
}
