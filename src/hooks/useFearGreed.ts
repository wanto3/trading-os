import { useState, useEffect, useCallback } from 'react';

export interface FearGreedData {
  value: number; // 0-100
  classification: string; // e.g. "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: Date;
}

interface FearGreedResponse {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

export function useFearGreed(refreshIntervalMs = 300000) {
  const [data, setData] = useState<FearGreedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFearGreed = useCallback(async () => {
    try {
      const res = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: FearGreedResponse = await res.json();
      const item = json.data[0];
      if (!item) throw new Error('No data returned');

      setData({
        value: parseInt(item.value, 10),
        classification: item.value_classification,
        timestamp: new Date(parseInt(item.timestamp, 10) * 1000),
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch Fear & Greed index');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFearGreed();
    const interval = setInterval(fetchFearGreed, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchFearGreed, refreshIntervalMs]);

  return { data, loading, error, refetch: fetchFearGreed };
}
