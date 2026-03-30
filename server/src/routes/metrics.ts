import { Router } from 'express';
import { get, set } from '../middleware/cache.js';

const router = Router();

const CG_BASE = 'https://api.coingecko.com/api/v3';
const YF_BASE = 'https://query1.finance.yahoo.com';

// ─── MVRV Z-Score ─────────────────────────────────────────────────────────────
router.get('/mvrv', async (_req, res) => {
  const cacheKey = 'btc:mvrv';
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    // Fetch current BTC price
    const priceRes = await fetch(
      `${CG_BASE}/simple/price?ids=bitcoin&vs_currency=usd&include_market_cap=true&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) }
    );

    // Fetch blockchain.com stats for realized cap
    const bcRes = await fetch('https://api.blockchain.info/stats', { signal: AbortSignal.timeout(8000) });

    // Fetch 2 years of BTC price history for MVRV calculation
    const histRes = await fetch(
      `${CG_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=730&interval=daily`,
      { signal: AbortSignal.timeout(10000) }
    );

    let price = 0;
    let marketCap = 0;
    let realizedCap = 0;

    if (priceRes.ok) {
      const priceData = (await priceRes.json()) as Record<string, { usd: number; usd_market_cap: number }>;
      price = priceData.bitcoin?.usd ?? 0;
      marketCap = priceData.bitcoin?.usd_market_cap ?? 0;
    }

    if (bcRes.ok) {
      const bcData = (await bcRes.json()) as Record<string, number>;
      const rc = bcData.realized_cap_usd;
      const mc = bcData.market_cap_usd;
      if (rc && mc) {
        realizedCap = rc;
        marketCap = mc;
      }
    }

    let mvrv = 0;
    let zScore = 1.0;
    if (realizedCap > 0) {
      mvrv = marketCap / realizedCap;
    } else if (marketCap > 0) {
      // Fallback: use market cap as proxy
      mvrv = 3.5;
      realizedCap = marketCap / mvrv;
    }

    // Calculate Z-score from price history
    if (histRes.ok) {
      const histData = (await histRes.json()) as { prices: [number, number][] };
      if (histData.prices && histData.prices.length > 30) {
        const prices = histData.prices.map(([, p]) => p);
        const window = Math.min(365, prices.length - 1);
        const realizedPrices: number[] = [];
        for (let i = window; i < prices.length; i++) {
          const slice = prices.slice(i - window, i);
          realizedPrices.push(slice.reduce((a, b) => a + b, 0) / slice.length);
        }
        const mvrvHistory = prices.slice(window).map((p, i) => p / realizedPrices[i]);
        if (mvrvHistory.length > 30) {
          const mean = mvrvHistory.reduce((a, b) => a + b, 0) / mvrvHistory.length;
          const variance = mvrvHistory.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / mvrvHistory.length;
          const stdDev = Math.sqrt(variance);
          zScore = stdDev > 0 ? (mvrvHistory[mvrvHistory.length - 1] - mean) / stdDev : 1.0;
        }
      }
    }

    // Calculate 7d ratio change
    let ratioChange7d = 0;
    if (histRes.ok) {
      const histData = (await histRes.json()) as { prices: [number, number][] };
      if (histData.prices && histData.prices.length >= 8) {
        const prices = histData.prices.map(([, p]) => p);
        const ma7: number[] = [];
        for (let i = 7; i < prices.length; i++) {
          const slice = prices.slice(i - 7, i);
          ma7.push(slice.reduce((a, b) => a + b, 0) / 7);
        }
        if (ma7.length >= 2) {
          const mvrvNow = prices[prices.length - 1] / ma7[ma7.length - 1];
          const mvrvThen = prices[7] / ma7[0];
          ratioChange7d = mvrvNow - mvrvThen;
        }
      }
    }

    const getZone = (m: number) => m < 1 ? 'undervalued' : m < 3.5 ? 'neutral' : m < 7 ? 'elevated' : 'extreme';
    const getZoneLabel = (z: string) => {
      if (z === 'undervalued') return 'Undervalued — historically strong buy zone';
      if (z === 'neutral') return 'Neutral — fair value range';
      if (z === 'elevated') return 'Elevated — approaching danger zone';
      return 'Extreme — cycle top risk elevated';
    };
    const getSignal = (m: number, z: number) => {
      if (m < 1.5 && z < 0) return { signal: 'buy' as const, label: 'Buy Signal', reason: 'MVRV below 1.5 + negative Z-score — historically strong accumulation zone' };
      if (m < 3.5) return { signal: 'hold' as const, label: 'Hold', reason: 'MVRV in neutral zone — no extreme over/undervaluation detected' };
      if (m < 7) return { signal: 'hold' as const, label: 'Caution', reason: 'MVRV elevated — approaching historical cycle-top levels' };
      return { signal: 'sell' as const, label: 'Sell Risk', reason: 'MVRV extreme (>7) — historically within 10-30% of cycle tops' };
    };

    const zone = getZone(mvrv || 3.5);
    const signalData = getSignal(mvrv || 3.5, zScore);

    const response = {
      ratio: mvrv || 3.5,
      ratioChange7d,
      zScore,
      zone,
      zoneLabel: getZoneLabel(zone),
      signal: signalData.signal,
      signalLabel: signalData.label,
      signalReason: signalData.reason,
      btcPrice: price,
      marketCap: marketCap || 0,
      realizedCap: realizedCap || 0,
      timestamp: Date.now(),
      history: [],
    };

    set(cacheKey, response, 3600);
    res.json({ data: response });
  } catch (err) {
    console.error('MVRV error:', err);
    res.status(500).json({ error: 'Failed to fetch MVRV data' });
  }
});

// ─── ETF Flows ────────────────────────────────────────────────────────────────
router.get('/etf-flows', async (_req, res) => {
  const cacheKey = 'btc:etf-flows';
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

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

  async function fetchEtf(ticker: string) {
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
      let consecutiveInflowDays = 0;
      for (let i = flows.length - 1; i >= 0; i--) {
        if (flows[i].direction === 'inflow') consecutiveInflowDays++;
        else break;
      }

      return {
        ticker,
        name: ETF_NAMES[ticker] ?? ticker,
        flows,
        netFlow7d,
        avgVolume7d,
      };
    } catch {
      return null;
    }
  }

  try {
    const [btcResults, ethResults] = await Promise.all([
      Promise.all(BTC_ETFS.map(fetchEtf)),
      Promise.all(ETH_ETFS.map(fetchEtf)),
    ]);

    const btcEtfs = btcResults.filter((r): r is NonNullable<typeof r> => r !== null);
    const ethEtfs = ethResults.filter((r): r is NonNullable<typeof r> => r !== null);

    const btcTotalNetFlow7d = btcEtfs.reduce((sum, e) => sum + e.netFlow7d, 0);
    const btcAvgVolume7d = btcEtfs.reduce((sum, e) => sum + e.avgVolume7d, 0) / Math.max(btcEtfs.length, 1);
    const btcConsecutive = btcEtfs.reduce((max, e) => {
      let count = 0;
      for (let i = e.flows.length - 1; i >= 0; i--) {
        if (e.flows[i].direction === 'inflow') count++;
        else break;
      }
      return Math.max(max, count);
    }, 0);
    const btcLatestChange = btcEtfs.length > 0 && btcEtfs[0].flows.length >= 2
      ? ((btcEtfs[0].flows[btcEtfs[0].flows.length - 1].price - btcEtfs[0].flows[btcEtfs[0].flows.length - 2].price)
         / btcEtfs[0].flows[btcEtfs[0].flows.length - 2].price) * 100
      : 0;

    const ethTotalNetFlow7d = ethEtfs.reduce((sum, e) => sum + e.netFlow7d, 0);
    const ethAvgVolume7d = ethEtfs.reduce((sum, e) => sum + e.avgVolume7d, 0) / Math.max(ethEtfs.length, 1);
    const ethConsecutive = ethEtfs.reduce((max, e) => {
      let count = 0;
      for (let i = e.flows.length - 1; i >= 0; i--) {
        if (e.flows[i].direction === 'inflow') count++;
        else break;
      }
      return Math.max(max, count);
    }, 0);

    // BTC price change from CoinGecko
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

    set(cacheKey, response, 1800);
    res.json({ data: response });
  } catch (err) {
    console.error('ETF flows error:', err);
    res.status(500).json({ error: 'Failed to fetch ETF data' });
  }
});

// ─── Pi Cycle ─────────────────────────────────────────────────────────────────
router.get('/pi-cycle', async (_req, res) => {
  const cacheKey = 'btc:pi-cycle';
  const cached = get<unknown>(cacheKey);
  if (cached) {
    res.json({ data: cached, _fromCache: true });
    return;
  }

  try {
    const [histRes, priceRes] = await Promise.all([
      fetch(`${CG_BASE}/coins/bitcoin/market_chart?vs_currency=usd&days=400&interval=daily`, { signal: AbortSignal.timeout(10000) }),
      fetch(`${CG_BASE}/simple/price?ids=bitcoin&vs_currency=usd`, { signal: AbortSignal.timeout(5000) }),
    ]);

    if (!histRes.ok) {
      res.status(502).json({ error: 'CoinGecko API error', status: histRes.status });
      return;
    }

    const histData = (await histRes.json()) as { prices: [number, number][] };
    const prices = histData.prices.map(([, p]) => p);

    if (prices.length < 350) {
      res.status(502).json({ error: 'Insufficient price history' });
      return;
    }

    let currentPrice = prices[prices.length - 1];
    if (priceRes.ok) {
      const priceData = (await priceRes.json()) as Record<string, { usd: number }>;
      currentPrice = priceData.bitcoin?.usd ?? currentPrice;
    }

    const calcSMA = (arr: number[], period: number): number | null => {
      if (arr.length < period) return null;
      const slice = arr.slice(-period);
      return slice.reduce((a, b) => a + b, 0) / period;
    };

    const ma111 = calcSMA(prices, 111);
    const ma350 = calcSMA(prices, 350);
    const ma200 = calcSMA(prices, 200);
    const ma365 = calcSMA(prices, 365);

    if (!ma111 || !ma350) {
      res.status(500).json({ error: 'Could not calculate moving averages' });
      return;
    }

    const ma111_2 = ma111 * 2;
    const btcPrice = currentPrice;

    // Check recent crossover
    let triggered = false;
    let crossPrice: number | null = null;
    const recentPrices = prices.slice(-30);
    for (let i = 1; i < recentPrices.length; i++) {
      const sliceBefore = prices.slice(0, prices.length - 30 + i);
      const sliceAfter = prices.slice(0, prices.length - 30 + i + 1);
      if (sliceBefore.length < 350 || sliceAfter.length < 350) continue;
      const ma111b = calcSMA(sliceBefore, 111);
      const ma111a = calcSMA(sliceAfter, 111);
      const ma350b = calcSMA(sliceBefore, 350);
      const ma350a = calcSMA(sliceAfter, 350);
      if (!ma111b || !ma111a || !ma350b || !ma350a) continue;
      if (ma111b * 2 <= ma350b && ma111a * 2 > ma350a) {
        triggered = true;
        crossPrice = prices[prices.length - 30 + i];
        break;
      }
    }

    let estTriggerPrice: number | null = null;
    if (!triggered && ma111_2 < ma350) {
      estTriggerPrice = Math.round(btcPrice * (ma350 / ma111_2));
    }

    // Mayer Multiple
    const mayerMultiple = ma200 ? btcPrice / ma200 : 1;
    const mayerScore = Math.min(100, Math.max(0,
      mayerMultiple <= 0.5 ? 5 : mayerMultiple >= 3.5 ? 95 :
      Math.round(((mayerMultiple - 0.5) / 3.0) * 100)
    ));
    const mayerStatus = mayerMultiple < 1 ? 'bullish' : mayerMultiple > 2.5 ? 'bearish' : 'neutral';

    // MVRV proxy
    const mvrvProxy = ma365 ? btcPrice / ma365 : 1;
    const mvrvScore = Math.min(100, Math.max(0, Math.round(((mvrvProxy - 0.5) / 8) * 100 + 10)));
    const mvrvStatus = mvrvProxy < 2 ? 'bullish' : mvrvProxy > 5 ? 'bearish' : 'neutral';

    // Puell Multiple
    const puellProxy = ma365 ? btcPrice / ma365 : 1;
    const puellScore = Math.min(100, Math.max(0, Math.round(((puellProxy - 0.5) / 3.0) * 100)));
    const puellStatus = puellProxy < 1 ? 'bullish' : puellProxy > 2 ? 'bearish' : 'neutral';

    // Golden Ratio
    const grRatio = btcPrice / (ma350 * 1.618);
    const grScore = Math.min(100, Math.max(0,
      grRatio < 0.5 ? 10 : grRatio > 2.0 ? 90 :
      Math.round(((grRatio - 0.5) / 1.5) * 80 + 10)
    ));
    const grStatus = grRatio < 0.8 ? 'bullish' : grRatio > 1.5 ? 'bearish' : 'neutral';

    const compositeScore = Math.round(mvrvScore * 0.3 + puellScore * 0.25 + mayerScore * 0.25 + grScore * 0.2);

    const cyclePhase = compositeScore > 75 ? 'peak' : compositeScore > 65 ? 'late' : compositeScore < 25 ? 'early' : 'mid';
    const cyclePhaseLabel = cyclePhase === 'peak' ? 'Peak zone — historically 2-4 weeks from local top'
      : cyclePhase === 'late' ? 'Late cycle — approaching overheated territory'
      : cyclePhase === 'early' ? 'Early cycle — accumulation zone'
      : 'Mid-cycle — normal market conditions';

    const compositeSignal = compositeScore < 25 ? 'buy'
      : compositeScore > 65 ? 'sell' : 'hold';
    const compositeSignalLabel = compositeScore < 25 ? 'Strong Buy'
      : compositeScore > 65 ? 'Sell Risk'
      : compositeScore > 50 ? 'Hold + Caution' : 'Hold';
    const compositeSignalReason = compositeScore < 25
      ? 'Composite score below 25 — historically strong accumulation zone'
      : compositeScore > 65
      ? 'Composite score above 65 — cycle top zone, reduce risk'
      : compositeScore > 50
      ? 'Composite score elevated — monitoring for top signals'
      : 'Composite cycle score in neutral range';

    const response = {
      piCycleTopTriggered: triggered,
      piCycleTopCrossPrice: crossPrice,
      piCycleTopEstTriggerPrice: estTriggerPrice,
      ma111,
      ma111_2,
      ma350,
      btcPrice,
      compositeScore,
      compositeSignal,
      compositeSignalLabel,
      compositeSignalReason,
      components: [
        { name: 'MVRV', value: Math.round(mvrvProxy * 100) / 100, score: mvrvScore, status: mvrvStatus },
        { name: 'Puell Multiple', value: Math.round(puellProxy * 100) / 100, score: puellScore, status: puellStatus },
        { name: 'Mayer Multiple', value: Math.round(mayerMultiple * 100) / 100, score: mayerScore, status: mayerStatus },
        { name: 'Golden Ratio', value: Math.round(grRatio * 100) / 100, score: grScore, status: grStatus },
      ],
      cyclePhase,
      cyclePhaseLabel,
      timestamp: Date.now(),
    };

    set(cacheKey, response, 3600);
    res.json({ data: response });
  } catch (err) {
    console.error('Pi Cycle error:', err);
    res.status(500).json({ error: 'Failed to fetch Pi Cycle data' });
  }
});

export default router;
