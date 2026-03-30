import { useEffect, useState } from 'react';
import type { ExchangeFundingRate } from '../../app/api/funding-rates/route';

export interface FundingRatesData {
  data: ExchangeFundingRate[];
  averageApr: number;
  timestamp: number;
}

export function useFundingRates() {
  const [data, setData] = useState<FundingRatesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/funding-rates', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const json = await res.json() as { data: ExchangeFundingRate[]; averageApr: number; timestamp: number };
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch funding rates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh every 3 minutes (funding rates are per 8h, so 3 min is enough to catch changes)
    const interval = setInterval(fetchData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { data, loading, error, refetch: fetchData };
}