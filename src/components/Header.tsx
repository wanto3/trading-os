import { useState, useEffect } from 'react';
import { Search, TrendingUp } from 'lucide-react';
import { useCoin } from '../context/CoinContext';

interface HeaderProps {
  btcPrice?: number;
  btcChange?: number;
  ethPrice?: number;
  ethChange?: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchResults: Array<{ id: string; name: string; symbol: string; thumb: string }>;
  onSelectCoin: (id: string) => void;
}

export function Header({ btcPrice, btcChange, ethPrice, ethChange, searchQuery, onSearchChange, searchResults, onSelectCoin }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-14 bg-bg-surface border-b border-border-subtle flex items-center px-4 gap-4 shrink-0">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-accent" />
        <span className="font-mono text-lg font-bold text-accent tracking-tight">TradeOS</span>
      </div>

      <div className="flex items-center gap-3 ml-4">
        {btcPrice && (
          <div className="flex items-center gap-1.5 bg-bg-primary px-3 py-1 rounded-full border border-border-subtle">
            <span className="text-text-secondary text-xs font-mono">BTC</span>
            <span className="font-mono text-sm font-semibold text-text-primary">${btcPrice.toLocaleString()}</span>
            {btcChange !== undefined && (
              <span className={`font-mono text-xs font-semibold ${btcChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
              </span>
            )}
          </div>
        )}
        {ethPrice && (
          <div className="flex items-center gap-1.5 bg-bg-primary px-3 py-1 rounded-full border border-border-subtle">
            <span className="text-text-secondary text-xs font-mono">ETH</span>
            <span className="font-mono text-sm font-semibold text-text-primary">${ethPrice.toLocaleString()}</span>
            {ethChange !== undefined && (
              <span className={`font-mono text-xs font-semibold ${ethChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                {ethChange >= 0 ? '+' : ''}{ethChange.toFixed(2)}%
              </span>
            )}
          </div>
        )}
      </div>

      <div className="relative flex-1 max-w-md mx-auto">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="text"
          placeholder="Search coins..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full bg-bg-primary border border-border-subtle rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-accent transition-colors"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-bg-surface border border-border-subtle rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
            {searchResults.map(coin => (
              <button
                key={coin.id}
                onClick={() => { onSelectCoin(coin.id); onSearchChange(''); }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-bg-primary text-left transition-colors"
              >
                <img src={coin.thumb} alt={coin.name} className="w-6 h-6 rounded-full" />
                <span className="text-text-primary text-sm font-medium">{coin.name}</span>
                <span className="text-text-secondary text-xs font-mono uppercase">{coin.symbol}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-text-secondary text-xs font-mono ml-auto">
        {time.toUTCString().slice(17, 25)} UTC
      </div>
    </header>
  );
}
