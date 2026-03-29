import { useState, useEffect, useCallback } from 'react';

export interface PredictionMarket {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  endDate: string;
  closed: boolean;
  slug: string;
  volume?: number;
}

interface GammaMarket {
  id: string;
  question: string;
  outcomes: string;
  outcomePrices: string;
  endDate: string;
  closed: boolean;
  slug: string;
  volume?: number;
}

const POLYMARKET_API = 'https://gamma-api.polymarket.com/markets';

const CRYPTO_KEYWORDS = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol', 'dogecoin', 'xrp', 'cardano', 'ada', 'fed', 'rate', 'tariff', 'sec', 'etf', 'defi', 'nft'];
const RELEVANCE_KEYWORDS = ['trump', 'election', 'economy', 'inflation', 'stock', 'market', 'oil', 'gold'];

function getRelevance(question: string): number {
  const q = question.toLowerCase();
  let score = 0;
  CRYPTO_KEYWORDS.forEach(k => { if (q.includes(k)) score += 10; });
  RELEVANCE_KEYWORDS.forEach(k => { if (q.includes(k)) score += 3; });
  return score;
}

export function usePredictions(refreshIntervalMs = 300000) {
  const [markets, setMarkets] = useState<PredictionMarket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch(`${POLYMARKET_API}?closed=false&limit=200`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GammaMarket[] = await res.json();

      const items: PredictionMarket[] = json
        .filter(m => !m.closed)
        .filter(m => new Date(m.endDate) > new Date())
        .filter((m) => {
          const outcomes: string[] = JSON.parse(m.outcomes || '[]');
          return outcomes.some(o => o.toLowerCase() === 'yes') &&
                 outcomes.some(o => o.toLowerCase() === 'no');
        })
        .map(m => {
          const outcomes: string[] = JSON.parse(m.outcomes || '[]');
          const prices: string[] = JSON.parse(m.outcomePrices || '[]');
          const yesIdx = outcomes.findIndex(o => o.toLowerCase() === 'yes');
          const noIdx = outcomes.findIndex(o => o.toLowerCase() === 'no');
          const yesPrice = yesIdx >= 0 ? parseFloat(prices[yesIdx]) : 0;
          const noPrice = noIdx >= 0 ? parseFloat(prices[noIdx]) : 0;
          return {
            id: m.id,
            question: m.question,
            yesPrice,
            noPrice,
            endDate: m.endDate,
            closed: m.closed,
            slug: m.slug,
            volume: m.volume,
          };
        })
        .sort((a, b) => getRelevance(b.question) - getRelevance(a.question))
        .slice(0, 15);

      setMarkets(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch prediction markets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const interval = setInterval(fetchMarkets, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchMarkets, refreshIntervalMs]);

  return { markets, loading, error, refetch: fetchMarkets };
}
