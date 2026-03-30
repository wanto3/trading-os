import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', DOGE: 'dogecoin',
  XRP: 'ripple', LINK: 'chainlink', ADA: 'cardano', ARB: 'arbitrum',
  MATIC: 'matic-network', AVAX: 'avalanche-2', DOT: 'polkadot', UNI: 'uniswap',
  OP: 'optimism', NEAR: 'near', INJ: 'injective-protocol', TIA: 'celestia',
  SEI: 'sei-network', WLD: 'worldcoin-wld', JUP: 'jupiter-agave', PYTH: 'pyth-network',
  AXL: 'axelar', DYM: 'dymension', JASMY: 'jasmycoin', STRK: 'starknet',
  SUI: 'sui', APT: 'aptos', AAVE: 'aave', MKR: 'maker',
  CRV: 'curve-dao-token', GMX: 'gmx', RENDER: 'render-token', FIL: 'filecoin',
  ICP: 'internet-computer', STX: 'blockstack', ALGO: 'algorand', VET: 'vechain',
  THETA: 'theta-token', APE: 'apecoin', FLOW: 'flow', CHZ: 'chiliz',
  ENJ: 'enjincoin', ZIL: 'zilliqa', ENS: 'ethereum-name-service',
};

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const ids = Object.values(COINGECKO_IDS).join(',');
    const url = `${CG_BASE}/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'CoinGecko API error', status: res.status }, { status: 502 });
    }

    const data = (await res.json()) as Array<{
      id: string; symbol: string; current_price: number;
      price_change_percentage_24h: number; total_volume: number;
    }>;

    const prices = data.map(coin => {
      const symbolKey = Object.entries(COINGECKO_IDS).find(([, v]) => v === coin.id)?.[0] ?? coin.symbol.toUpperCase();
      return {
        symbol: symbolKey,
        price: coin.current_price ?? 0,
        volume24h: coin.total_volume ?? 0,
        quoteVolume24h: coin.total_volume ?? 0,
        priceChangePercent: coin.price_change_percentage_24h ?? 0,
        timestamp: Date.now(),
      };
    });

    return NextResponse.json({ _endpoint: 'prices', data: prices });
  } catch (err) {
    console.error('Prices API error:', err);
    return NextResponse.json({ error: 'Failed to fetch prices' }, { status: 500 });
  }
}
