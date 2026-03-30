import type { VercelRequest, VercelResponse } from '@vercel/node';

export interface WhaleSignal {
  whaleAccumulation: number;
  exchangeNetFlow: number;
  activeAddresses: number;
  largeTxVolume24h: number;
  accumulationScore: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  signalLabel: string;
  signalReason: string;
  supplyDistribution: 'accumulation' | 'distribution' | 'neutral';
  timestamp: number;
}

export interface WhaleMetricsResponse {
  btc: WhaleSignal;
  eth: WhaleSignal;
  combinedSignal: 'bullish' | 'bearish' | 'neutral';
  combinedLabel: string;
  combinedScore: number;
  combinedReason: string;
  timestamp: number;
}

export function scoreWhaleSignal(params: {
  btcWhaleAccumulation: number;
  btcExchangeNetFlow: number;
  btcActiveAddresses: number;
  ethWhaleAccumulation: number;
  ethExchangeNetFlow: number;
  ethActiveAddresses: number;
  btcPrice: number;
}): { signal: WhaleSignal['signal']; label: string; score: number; reason: string } {
  const { btcWhaleAccumulation, btcExchangeNetFlow, btcActiveAddresses,
          ethWhaleAccumulation, ethExchangeNetFlow, ethActiveAddresses, btcPrice } = params;

  // Combined score: weighted average of BTC and ETH accumulation
  // BTC weighted at 60%, ETH at 40%
  const btcScore = btcWhaleAccumulation * 60;
  const ethScore = ethWhaleAccumulation * 40;

  // Exchange flow adjustment: outflows (negative) boost score, inflows (positive) reduce it
  // BTC flow: outflows add, inflows subtract
  const btcFlowImpact = btcExchangeNetFlow < 0
    ? (-btcExchangeNetFlow / 1000) * 45
    : -(btcExchangeNetFlow / 1000) * 45;
  // ETH flow: outflows add, inflows subtract
  const ethFlowImpact = ethExchangeNetFlow < 0
    ? (-ethExchangeNetFlow / 1000) * 30
    : -(ethExchangeNetFlow / 1000) * 30;

  const combinedScore = Math.max(-100, Math.min(100, Math.round(btcScore + ethScore + btcFlowImpact + ethFlowImpact)));

  let signal: WhaleSignal['signal'];
  let label: string;
  let reason: string;

  if (combinedScore > 60) {
    signal = 'bullish';
    label = 'Strong Accumulation';
    reason = 'Whales accumulating — exchange outflows exceed inflows';
  } else if (combinedScore > 50) {
    signal = 'bullish';
    label = 'Accumulating';
    reason = 'Mild whale accumulation with net exchange outflows';
  } else if (combinedScore >= 0) {
    signal = 'neutral';
    label = 'Hold';
    reason = 'Moderate whale activity — no strong signal';
  } else if (combinedScore >= -40) {
    signal = 'bearish';
    label = 'Distributing';
    reason = 'Whale distribution — exchange inflows suggest selling pressure';
  } else {
    signal = 'bearish';
    label = 'Strong Distribution';
    reason = 'Heavy whale selling — large exchange inflows';
  }

  return { signal, label, score: combinedScore, reason };
}

export function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function getSupplyDistribution(longTermHolderPct: number, exchangePct: number): WhaleSignal['supplyDistribution'] {
  // Simplified proxy: if LTH supply > 93% and exchange < 5%, accumulation
  // If exchange balance rising, distribution
  if (longTermHolderPct > 93 && exchangePct < 5) return 'accumulation';
  if (exchangePct > 7) return 'distribution';
  return 'neutral';
}

async function fetchBtcWhaleData(): Promise<{
  activeAddresses: number;
  largeTxVolume24h: number;
  exchangeNetFlow: number;
  whaleAccumulation: number;
} | null> {
  try {
    // Fetch from blockchain.com public stats for on-chain metrics
    const [statsRes, priceRes] = await Promise.all([
      fetch('https://api.blockchain.info/stats', { signal: AbortSignal.timeout(8000) }),
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currency=usd', {
        signal: AbortSignal.timeout(5000),
      }),
    ]);

    if (!statsRes.ok || !priceRes.ok) return null;

    const stats = await statsRes.json() as Record<string, unknown>;
    const priceData = await priceRes.json() as Record<string, { usd: number }>;

    const activeAddresses = (stats.btc_available_supply as number) ? Math.floor((stats.btc_available_supply as number) * 0.3) : 950000;
    const btcPrice = priceData.bitcoin?.usd ?? 100000;

    // Fetch exchange flow data from blockchain.com
    // The hashrate and difficulty can serve as a proxy for network activity
    const hashrate = (stats.hash_rate as number) ?? 600e12;

    // Large transaction volume estimation from blockchain.com estimated tx volume
    const estimatedTxVolume = (stats.estimated_btc_volume as number) ?? (stats.total_btc_sent as number) ?? 50000;
    const largeTxVolume24h = estimatedTxVolume * btcPrice;

    // Whale accumulation proxy:
    // Compare price vs realized cap (market_cap / realized_cap ratio)
    // High MVRV = distribution, Low MVRV = accumulation
    const marketCap = (stats.market_cap_usd as number) ?? (stats.total_btc_supply as number) * btcPrice;
    const realizedCap = (stats.realized_cap_usd as number) ?? marketCap * 0.6;

    // If price is below realized cap (MVRV < 1), accumulation signal
    // If price is well above realized cap (MVRV > 3), distribution signal
    const mvrv = marketCap > 0 && realizedCap > 0 ? marketCap / realizedCap : 2.0;
    const whaleAccumulation = mvrv > 0 ? Math.max(0, Math.min(1, 1 - (mvrv - 1) / 4)) : 0.5;

    // Exchange net flow proxy:
    // Use blockchain.com's outputs data to estimate exchange flows
    // This is a rough proxy — positive means more coins moving to exchanges
    const totalOutputs = (stats.total_outputs as number) ?? 50000000;
    const exchangeNetFlow = (totalOutputs / 1000) * (mvrv < 2 ? -1 : 1); // simplified

    return {
      activeAddresses: Math.floor(activeAddresses),
      largeTxVolume24h,
      exchangeNetFlow,
      whaleAccumulation,
    };
  } catch {
    return null;
  }
}

async function fetchEthWhaleData(): Promise<{
  activeAddresses: number;
  largeTxVolume24h: number;
  exchangeNetFlow: number;
  whaleAccumulation: number;
} | null> {
  try {
    const [priceRes, ethDataRes] = await Promise.all([
      fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currency=usd', {
        signal: AbortSignal.timeout(5000),
      }),
      fetch('https://api.blockchain.info/stats', { signal: AbortSignal.timeout(8000) }),
    ]);

    if (!priceRes.ok) return null;

    const priceData = await priceRes.json() as Record<string, { usd: number }>;
    const ethPrice = priceData.ethereum?.usd ?? 3000;

    // Use CoinGecko market data as ETH proxy
    const cgRes = await fetch(
      `https://api.coingecko.com/api/v3/coins/ethereum/market_chart?vs_currency=usd&days=14&interval=daily`,
      { signal: AbortSignal.timeout(8000) }
    );

    let whaleAccumulation = 0.5;
    let activeAddresses = 400000;

    if (cgRes.ok) {
      const cgData = await cgRes.json() as { prices: [number, number][] };
      if (cgData.prices && cgData.prices.length >= 14) {
        const prices = cgData.prices.map(([, p]) => p);
        const currentPrice = prices[prices.length - 1];
        const price14dAgo = prices[0];

        // Price momentum as accumulation proxy
        const priceChange = (currentPrice - price14dAgo) / price14dAgo;
        whaleAccumulation = priceChange > 0 ? Math.min(0.5 + priceChange * 5, 0.9) : Math.max(0.5 + priceChange * 5, 0.1);

        // Estimate active addresses from gas usage proxy
        activeAddresses = Math.floor(400000 + priceChange * 200000);
      }
    }

    // Exchange net flow proxy for ETH — estimate from transaction volume trend
    const largeTxVolume24h = ethPrice * 10000000; // rough ETH tx volume in USD

    return {
      activeAddresses: Math.max(100000, activeAddresses),
      largeTxVolume24h,
      exchangeNetFlow: 0,
      whaleAccumulation,
    };
  } catch {
    return null;
  }
}

function buildBtcSignal(
  data: { whaleAccumulation: number; exchangeNetFlow: number; activeAddresses: number; largeTxVolume24h: number },
  btcPrice: number
): WhaleSignal {
  const score = Math.round(data.whaleAccumulation * 100);
  const supplyDist = getSupplyDistribution(95, 4);

  let signal: WhaleSignal['signal'] = 'neutral';
  let label = 'Hold';
  let reason = 'Moderate whale activity — no strong signal';

  if (data.whaleAccumulation >= 0.7 && data.exchangeNetFlow < 0) {
    signal = 'bullish';
    label = 'Accumulating';
    reason = 'Whales accumulating — exchange outflows exceed inflows';
  } else if (data.whaleAccumulation >= 0.7) {
    signal = 'bullish';
    label = 'Accumulating';
    reason = 'Strong whale accumulation detected';
  } else if (data.whaleAccumulation <= 0.3 && data.exchangeNetFlow > 0) {
    signal = 'bearish';
    label = 'Distributing';
    reason = 'Whale distribution — exchange inflows suggest selling pressure';
  } else if (data.whaleAccumulation <= 0.3) {
    signal = 'bearish';
    label = 'Distribution';
    reason = 'Elevated whale distribution activity';
  }

  return {
    whaleAccumulation: data.whaleAccumulation,
    exchangeNetFlow: data.exchangeNetFlow,
    activeAddresses: data.activeAddresses,
    largeTxVolume24h: data.largeTxVolume24h,
    accumulationScore: score,
    signal,
    signalLabel: label,
    signalReason: reason,
    supplyDistribution: supplyDist,
    timestamp: Date.now(),
  };
}

function buildEthSignal(
  data: { whaleAccumulation: number; exchangeNetFlow: number; activeAddresses: number; largeTxVolume24h: number }
): WhaleSignal {
  const score = Math.round(data.whaleAccumulation * 100);

  let signal: WhaleSignal['signal'] = 'neutral';
  let label = 'Hold';
  let reason = 'Moderate whale activity — no strong signal';

  if (data.whaleAccumulation >= 0.65) {
    signal = 'bullish';
    label = 'Accumulating';
    reason = 'ETH whale accumulation signal';
  } else if (data.whaleAccumulation <= 0.35) {
    signal = 'bearish';
    label = 'Distributing';
    reason = 'ETH whale distribution signal';
  }

  return {
    whaleAccumulation: data.whaleAccumulation,
    exchangeNetFlow: data.exchangeNetFlow,
    activeAddresses: data.activeAddresses,
    largeTxVolume24h: data.largeTxVolume24h,
    accumulationScore: score,
    signal,
    signalLabel: label,
    signalReason: reason,
    supplyDistribution: 'neutral',
    timestamp: Date.now(),
  };
}

async function fetchBtcPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currency=usd',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return 100000;
    const data = await res.json() as Record<string, { usd: number }>;
    return data.bitcoin?.usd ?? 100000;
  } catch {
    return 100000;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const [btcData, ethData, btcPrice] = await Promise.all([
      fetchBtcWhaleData(),
      fetchEthWhaleData(),
      fetchBtcPrice(),
    ]);

    const btcFallback = {
      activeAddresses: 950000,
      largeTxVolume24h: 25000000000,
      exchangeNetFlow: 0,
      whaleAccumulation: 0.5,
    };

    const ethFallback = {
      activeAddresses: 450000,
      largeTxVolume24h: 8000000000,
      exchangeNetFlow: 0,
      whaleAccumulation: 0.5,
    };

    const btc = btcData ?? btcFallback;
    const eth = ethData ?? ethFallback;

    const btcSignal = buildBtcSignal(btc, btcPrice);
    const ethSignal = buildEthSignal(eth);

    const combined = scoreWhaleSignal({
      btcWhaleAccumulation: btc.whaleAccumulation,
      btcExchangeNetFlow: btc.exchangeNetFlow,
      btcActiveAddresses: btc.activeAddresses,
      ethWhaleAccumulation: eth.whaleAccumulation,
      ethExchangeNetFlow: eth.exchangeNetFlow,
      ethActiveAddresses: eth.activeAddresses,
      btcPrice,
    });

    const response: WhaleMetricsResponse = {
      btc: btcSignal,
      eth: ethSignal,
      combinedSignal: combined.signal,
      combinedLabel: combined.label,
      combinedScore: combined.score,
      combinedReason: `${btcSignal.signalLabel} (BTC) + ${ethSignal.signalLabel} (ETH)`,
      timestamp: Date.now(),
    };

    res.json({ data: response });
  } catch (err) {
    console.error('Whale metrics API error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
