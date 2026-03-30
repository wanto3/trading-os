import { useEffect, useState } from 'react';

export interface WhaleSignalData {
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

export interface WhaleMetricsData {
  btc: WhaleSignalData;
  eth: WhaleSignalData;
  combinedSignal: 'bullish' | 'bearish' | 'neutral';
  combinedLabel: string;
  combinedScore: number;
  combinedReason: string;
  timestamp: number;
}

export function useWhaleMetrics() {
  const [data, setData] = useState<WhaleMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const res = await fetch('/api/whale-metrics', {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json() as { data: WhaleMetricsData };

        if (!cancelled) {
          setData(json.data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch whale metrics');
          setLoading(false);
        }
      }
    }

    fetchData();
    // Refresh every 15 minutes
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { data, loading, error };
}

export function formatLargeNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}
