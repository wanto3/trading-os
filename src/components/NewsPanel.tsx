import { useCryptoNews, type NewsItem } from '../hooks/useCryptoNews';
import { RefreshCw, ExternalLink } from 'lucide-react';

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function SentimentDot({ sentiment }: { sentiment: NewsItem['sentiment'] }) {
  return (
    <div
      className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
        sentiment === 'positive' ? 'bg-[#3fb950]' :
        sentiment === 'negative' ? 'bg-[#f85149]' : 'bg-[#8b949e]'
      }`}
      title={sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    />
  );
}

export function NewsPanel() {
  const { news, loading, error, refetch } = useCryptoNews();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-text-secondary text-xs font-semibold uppercase tracking-wider">
          Live Crypto News
        </p>
        <button
          onClick={refetch}
          className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all"
          title="Refresh news"
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {loading && news.length === 0 ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error && news.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-text-secondary text-xs mb-1">Failed to load news</p>
          <button onClick={refetch} className="text-xs text-accent hover:underline">Try again</button>
        </div>
      ) : (
        news.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-bg-primary rounded-lg p-3 border border-border-subtle hover:border-accent/40 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-text-primary text-sm leading-snug group-hover:text-accent transition-colors">
                {item.title}
              </p>
              <SentimentDot sentiment={item.sentiment} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-text-secondary text-xs">{item.source}</span>
              <span className="text-border-subtle text-xs">·</span>
              <span className="text-text-secondary text-xs">{timeAgo(item.publishedAt)}</span>
              <ExternalLink size={10} className="text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
            </div>
          </a>
        ))
      )}
    </div>
  );
}
