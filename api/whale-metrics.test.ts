import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cache module
vi.mock('./cache.js', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('AbortSignal', { timeout: (ms: number) => ({ signal: { aborted: false }, timeout: ms }) });

// Import after mocking
import type { WhaleMetricsResponse, WhaleSignal } from './whale-metrics.js';
import {
  scoreWhaleSignal,
  formatLargeNumber,
  getSupplyDistribution,
} from './whale-metrics.js';

describe('scoreWhaleSignal', () => {
  it('returns bullish when whale accumulation is positive and exchange outflows dominate', () => {
    const result = scoreWhaleSignal({
      btcWhaleAccumulation: 0.7,
      btcExchangeNetFlow: -500,
      btcActiveAddresses: 1000000,
      ethWhaleAccumulation: 0.6,
      ethExchangeNetFlow: -200,
      ethActiveAddresses: 500000,
      btcPrice: 100000,
    });
    expect(result.signal).toBe('bullish');
    expect(['Strong Accumulation', 'Accumulating', 'Buy Signal']).toContain(result.label);
  });

  it('returns bearish when whale distribution is high and exchange inflows dominate', () => {
    const result = scoreWhaleSignal({
      btcWhaleAccumulation: 0.2,
      btcExchangeNetFlow: 800,
      btcActiveAddresses: 500000,
      ethWhaleAccumulation: 0.2,
      ethExchangeNetFlow: 400,
      ethActiveAddresses: 200000,
      btcPrice: 100000,
    });
    expect(result.signal).toBe('bearish');
    expect(['Strong Distribution', 'Distributing', 'Sell Signal']).toContain(result.label);
  });

  it('returns neutral when whale accumulation is moderate and flows are mixed', () => {
    const result = scoreWhaleSignal({
      btcWhaleAccumulation: 0.5,
      btcExchangeNetFlow: 0,
      btcActiveAddresses: 800000,
      ethWhaleAccumulation: 0.5,
      ethExchangeNetFlow: 0,
      ethActiveAddresses: 400000,
      btcPrice: 100000,
    });
    expect(result.signal).toBe('neutral');
    expect(result.label).toBe('Hold');
  });

  it('returns a score between -100 and 100', () => {
    const result = scoreWhaleSignal({
      btcWhaleAccumulation: 0.7,
      btcExchangeNetFlow: -500,
      btcActiveAddresses: 1000000,
      ethWhaleAccumulation: 0.6,
      ethExchangeNetFlow: -200,
      ethActiveAddresses: 500000,
      btcPrice: 100000,
    });
    expect(result.score).toBeGreaterThanOrEqual(-100);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('factors in exchange flow direction and magnitude', () => {
    const result1 = scoreWhaleSignal({
      btcWhaleAccumulation: 0.5,
      btcExchangeNetFlow: -1000,
      btcActiveAddresses: 800000,
      ethWhaleAccumulation: 0.5,
      ethExchangeNetFlow: -500,
      ethActiveAddresses: 400000,
      btcPrice: 100000,
    });
    const result2 = scoreWhaleSignal({
      btcWhaleAccumulation: 0.5,
      btcExchangeNetFlow: 1000,
      btcActiveAddresses: 800000,
      ethWhaleAccumulation: 0.5,
      ethExchangeNetFlow: 500,
      ethActiveAddresses: 400000,
      btcPrice: 100000,
    });
    expect(result1.score).toBeGreaterThan(result2.score);
  });
});

describe('formatLargeNumber', () => {
  it('formats billions with B suffix', () => {
    expect(formatLargeNumber(1.5e9)).toBe('$1.50B');
  });

  it('formats millions with M suffix', () => {
    expect(formatLargeNumber(5.5e6)).toBe('$5.50M');
  });

  it('formats thousands with K suffix', () => {
    expect(formatLargeNumber(50000)).toBe('$50.00K');
  });

  it('formats small numbers with no suffix', () => {
    expect(formatLargeNumber(500)).toBe('$500');
  });

  it('formats negative small numbers', () => {
    expect(formatLargeNumber(-500)).toBe('-$500');
  });

  it('handles negative values', () => {
    expect(formatLargeNumber(-1.5e9)).toBe('-$1.50B');
  });
});

describe('getSupplyDistribution', () => {
  it('returns accumulation when long-term holder supply increases', () => {
    const result = getSupplyDistribution(95, 3);
    expect(result).toBe('accumulation');
  });

  it('returns distribution when exchange balance increases', () => {
    const result = getSupplyDistribution(90, 8);
    expect(result).toBe('distribution');
  });

  it('returns neutral when supply is stable', () => {
    const result = getSupplyDistribution(92, 5);
    expect(result).toBe('neutral');
  });
});

describe('WhaleMetricsResponse shape', () => {
  it('has required fields for BTC whale data', () => {
    const response: WhaleMetricsResponse = {
      btc: {
        whaleAccumulation: 0.65,
        exchangeNetFlow: -200,
        activeAddresses: 950000,
        largeTxVolume24h: 25000000000,
        accumulationScore: 72,
        signal: 'bullish',
        signalLabel: 'Accumulating',
        signalReason: 'Whales accumulating — exchange outflows exceed inflows',
        supplyDistribution: 'accumulation',
        timestamp: Date.now(),
      },
      eth: {
        whaleAccumulation: 0.55,
        exchangeNetFlow: -100,
        activeAddresses: 450000,
        largeTxVolume24h: 8000000000,
        accumulationScore: 58,
        signal: 'neutral',
        signalLabel: 'Hold',
        signalReason: 'Moderate whale activity — no strong signal',
        supplyDistribution: 'neutral',
        timestamp: Date.now(),
      },
      combinedSignal: 'bullish',
      combinedLabel: 'Buy Signal',
      combinedScore: 65,
      combinedReason: 'BTC whale accumulation + ETH neutral stance',
      timestamp: Date.now(),
    };

    expect(response.btc.whaleAccumulation).toBeGreaterThanOrEqual(0);
    expect(response.btc.whaleAccumulation).toBeLessThanOrEqual(1);
    expect(response.btc.exchangeNetFlow).toBeDefined();
    expect(response.btc.activeAddresses).toBeGreaterThan(0);
    expect(response.combinedScore).toBeGreaterThanOrEqual(-100);
    expect(response.combinedScore).toBeLessThanOrEqual(100);
  });
});
