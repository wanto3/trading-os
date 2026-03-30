import { NextResponse } from 'next/server';

const YF_BASE = 'https://query1.finance.yahoo.com';
const CG_BASE = 'https://api.coingecko.com/api/v3';

const BTC_ETFS = ['IBIT', 'FBTC', 'GBTC', 'ARKB', 'BITB', 'EZBC'];
const ETH_ETFS = ['ETHA', 'EETH', 'CETH'];

const ETF_NAMES: Record<string, string> = {
  IBIT: 'iShares Bitcoin Trust',
  FBTC: 'Fidelity Wise Origin Bitcoin',
  GBTC: 'Grayscale Bitcoin Trust',
  ARKB: 'Ark 21Shares Bitcoin ETF',
  BITB: 'Bitwise Bitcoin ETF',
  EZBC: 'Franklin Bitcoin ETF',
  ETHA: 'iShares Ethereum Trust',
  EETH: 'Fidelity Ethereum Fund',
  CETH: 'Cath Ethereum Fund',
};

interface EtfFlowResult {
  ticker: string;
  name: string;
  flows: Array<{ date: string; price: number; volume: number; flow: number; direction: string }>;
  netFlow7d: number;
  avgVolume7d: number;
}

async function fetchEtf(ticker: string): Promise<EtfFlowResult | null> {
  try {
    const url = `${YF_BASE}/v8/finance/chart/${ticker}?interval=1d&range=7d`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as {
      chart: { result: Array<{ indicators: { quote: Array<{ close: (number | null)[]; volume: (number | null)[]; timestamp: number[] }> } }> };
    };
    const result = data.chart.result?.[0];
    if (!result) return null;
    const q = result.indicators.quote[0];
    if (!q.close || q.close.length === 0) return null;

    const closes: number[] = [];
    const volumes: number[] = [];
    for (let i = 0; i < q.close.length; i++) {
      if (q.close[i] != null && q.volume[i] != null) {
        closes.push(q.close[i] as number);
        volumes.push(q.volume[i] as number);
      }
    }
    if (closes.length < 2) return null;

    const flows: Array<{ date: string; price: number; volume: number; flow: number; direction: string }> = [];
    for (let i = 0; i < closes.length; i++) {
      const prev = closes[i - 1] ?? closes[i];
      const priceChange = (closes[i] - prev) / prev;
      const avgPrice = (closes[i] + prev) / 2;
      const flow = priceChange * volumes[i] * avgPrice;
      flows.push({
        date: new Date((q.timestamp[i] ?? Date.now() / 1000) * 1000).toISOString().split('T')[0],
        price: closes[i],
        volume: volumes[i],
        flow,
        direction: flow > 0 ? 'inflow' : flow < 0 ? 'outflow' : 'neutral',
      });
    }

    const netFlow7d = flows.reduce((sum, f) => sum + f.flow, 0);
    const avgVolume7d = flows.reduce((sum, f) => sum + f.volume, 0) / flows.length;

    return { ticker, name: ETF_NAMES[ticker] ?? ticker, flows, netFlow7d, avgVolume7d };
  } catch {
    return null;
  }
}

function countConsecutive(flows: Array<{ direction: string }>): number {
  let count = 0;
  for (let i = flows.length - 1; i >= 0; i--) {
    if (flows[i].direction === 'inflow') count++;
    else break;
  }
  return count;
}

export async function GET() {
  const [btcResults, ethResults] = await Promise.all([
    Promise.all(BTC_ETFS.map(fetchEtf)),
    Promise.all(ETH_ETFS.map(fetchEtf)),
  ]);

  const btcEtfs = btcResults.filter((r): r is EtfFlowResult => r !== null);
  const ethEtfs = ethResults.filter((r): r is EtfFlowResult => r !== null);

  const btcTotalNetFlow7d = btcEtfs.reduce((sum, e) => sum + e.netFlow7d, 0);
  const btcAvgVolume7d = btcEtfs.reduce((sum, e) => sum + e.avgVolume7d, 0) / Math.max(btcEtfs.length, 1);
  const btcConsecutive = btcEtfs.reduce((max, e) => Math.max(max, countConsecutive(e.flows)), 0);
  const btcLatestChange = btcEtfs.length > 0 && btcEtfs[0].flows.length >= 2
    ? ((btcEtfs[0].flows[btcEtfs[0].flows.length - 1].price - btcEtfs[0].flows[btcEtfs[0].flows.length - 2].price)
       / btcEtfs[0].flows[btcEtfs[0].flows.length - 2].price) * 100
    : 0;

  const ethTotalNetFlow7d = ethEtfs.reduce((sum, e) => sum + e.netFlow7d, 0);
  const ethAvgVolume7d = ethEtfs.reduce((sum, e) => sum + e.avgVolume7d, 0) / Math.max(ethEtfs.length, 1);
  const ethConsecutive = ethEtfs.reduce((max, e) => Math.max(max, countConsecutive(e.flows)), 0);

  let btcPriceChange24h = 0;
  try {
    const cgRes = await fetch(
      `${CG_BASE}/simple/price?ids=bitcoin,ethereum&vs_currency=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (cgRes.ok) {
      const cgData = (await cgRes.json()) as Record<string, { usd_24h_change: number }>;
      btcPriceChange24h = cgData.bitcoin?.usd_24h_change ?? 0;
    }
  } catch { /* use 0 */ }

  const response = {
    btc: {
      etfs: btcEtfs,
      totalNetFlow7d: btcTotalNetFlow7d,
      avgVolume7d: btcAvgVolume7d,
      consecutiveInflowDays: btcConsecutive,
      latestPriceChange: btcLatestChange,
    },
    eth: {
      etfs: ethEtfs,
      totalNetFlow7d: ethTotalNetFlow7d,
      avgVolume7d: ethAvgVolume7d,
      consecutiveInflowDays: ethConsecutive,
      latestPriceChange: 0,
    },
    timestamp: Date.now(),
    btcPriceChange24h,
  };

  return NextResponse.json({ data: response });
}
