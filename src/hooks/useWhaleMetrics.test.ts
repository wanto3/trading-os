import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { renderHook, waitFor } from '@testing-library/react';
import { useWhaleMetrics } from './useWhaleMetrics';

// We need to mock React for the hook
import React from 'react';

const MOCK_WHALE_RESPONSE = {
  data: {
    btc: {
      whaleAccumulation: 0.72,
      exchangeNetFlow: -350,
      activeAddresses: 980000,
      largeTxVolume24h: 28000000000,
      accumulationScore: 72,
      signal: 'bullish',
      signalLabel: 'Accumulating',
      signalReason: 'Whales accumulating — exchange outflows exceed inflows',
      supplyDistribution: 'accumulation',
      timestamp: Date.now(),
    },
    eth: {
      whaleAccumulation: 0.58,
      exchangeNetFlow: -150,
      activeAddresses: 460000,
      largeTxVolume24h: 8500000000,
      accumulationScore: 58,
      signal: 'neutral',
      signalLabel: 'Hold',
      signalReason: 'Moderate whale activity — no strong signal',
      supplyDistribution: 'neutral',
      timestamp: Date.now(),
    },
    combinedSignal: 'bullish',
    combinedLabel: 'Accumulating',
    combinedScore: 65,
    combinedReason: 'Accumulating (BTC) + Hold (ETH)',
    timestamp: Date.now(),
  },
};

describe('useWhaleMetrics', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('returns whale metrics data on successful fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_WHALE_RESPONSE),
    });

    const { result } = renderHook(() => useWhaleMetrics());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.btc.whaleAccumulation).toBe(0.72);
    expect(result.current.data!.combinedSignal).toBe('bullish');
    expect(result.current.data!.combinedScore).toBe(65);
  });

  it('returns error on failed fetch', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useWhaleMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('returns error when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useWhaleMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toContain('Failed to fetch whale metrics');
  });

  it('parses BTC and ETH whale signals correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_WHALE_RESPONSE),
    });

    const { result } = renderHook(() => useWhaleMetrics());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const data = result.current.data!;
    expect(data.btc.signal).toBe('bullish');
    expect(data.btc.exchangeNetFlow).toBe(-350);
    expect(data.btc.supplyDistribution).toBe('accumulation');
    expect(data.eth.signal).toBe('neutral');
  });
});
