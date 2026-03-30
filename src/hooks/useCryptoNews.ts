import { useState, useEffect, useCallback } from 'react';

export type SentimentType = 'positive' | 'negative' | 'neutral';

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: Date;
  url: string;
  sentiment: SentimentType;
  categories: string[];
}

interface CoinGeckoNewsItem {
  id: number;
  title: string;
  description: string;
  author: string;
  url: string;
  news_site: string;
  created_at: number;
  thumb_2x: string;
}

interface CoinGeckoNewsResponse {
  data: CoinGeckoNewsItem[];
}

const POSITIVE_KEYWORDS = ['surge', 'bullish', 'record', 'growth', 'adoption', 'approval', 'upgrade', 'rally', 'gain', 'soar', 'jump', 'boom', 'high'];
const NEGATIVE_KEYWORDS = ['crash', 'bearish', 'loss', 'drop', 'plunge', 'fall', 'decline', 'ban', 'hack', 'scam', 'risk', 'warn', 'selloff', 'fear', 'regulation'];

function inferSentiment(title: string, apiSentiment?: number): SentimentType {
  if (apiSentiment !== undefined) {
    if (apiSentiment > 0.1) return 'positive';
    if (apiSentiment < -0.1) return 'negative';
    return 'neutral';
  }
  const lower = title.toLowerCase();
  const posCount = POSITIVE_KEYWORDS.filter(k => lower.includes(k)).length;
  const negCount = NEGATIVE_KEYWORDS.filter(k => lower.includes(k)).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

export function useCryptoNews(refreshIntervalMs = 300000) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${API_BASE}/api/news`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: CoinGeckoNewsResponse = await res.json();

      const items: NewsItem[] = json.data.slice(0, 20).map((item) => ({
        id: String(item.id),
        title: item.title,
        source: item.news_site,
        publishedAt: new Date(item.created_at * 1000),
        url: item.url,
        sentiment: inferSentiment(item.title),
        categories: [],
      }));

      setNews(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchNews, refreshIntervalMs]);

  return { news, loading, error, refetch: fetchNews };
}
