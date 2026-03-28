import { CoinMarket } from '../lib/coingecko';
import { GlobalData } from '../lib/coingecko';

interface StatsPanelProps {
  coins: CoinMarket[];
  globalData?: GlobalData['data'];
}

export function StatsPanel({ coins, globalData }: StatsPanelProps) {
  const totalMarketCap = globalData?.total_market_cap?.usd || 0;
  const totalVolume = globalData?.total_volume?.usd || 0;
  const btcDom = globalData?.market_cap_percentage?.btc || 0;
  const ethDom = globalData?.market_cap_percentage?.eth || 0;
  const marketChange = globalData?.market_cap_change_percentage_24h_usd || 0;

  const topCoins = coins.slice(0, 5);
  const topMcap = topCoins.reduce((s, c) => s + c.market_cap, 0);
  const colors = ['#f7931a', '#627eea', '#26a17b', '#e84142', '#0033ad'];
  const sizes = topCoins.map(c => ((c.market_cap / topMcap) * 100).toFixed(1));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
          <p className="text-text-secondary text-xs mb-1">Market Cap</p>
          <p className="font-mono text-lg font-bold text-text-primary">
            ${totalMarketCap > 1e12 ? `${(totalMarketCap / 1e12).toFixed(2)}T` : `${(totalMarketCap / 1e9).toFixed(0)}B`}
          </p>
        </div>
        <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
          <p className="text-text-secondary text-xs mb-1">24h Volume</p>
          <p className="font-mono text-lg font-bold text-text-primary">
            ${totalVolume > 1e12 ? `${(totalVolume / 1e12).toFixed(2)}T` : `${(totalVolume / 1e9).toFixed(0)}B`}
          </p>
        </div>
        <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
          <p className="text-text-secondary text-xs mb-1">Market Change</p>
          <p className={`font-mono text-lg font-bold ${marketChange >= 0 ? 'text-gain' : 'text-loss'}`}>
            {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Market Dominance</h3>
        <div className="flex items-center gap-6">
          <div className="relative" style={{ width: 120, height: 120 }}>
            <svg viewBox="0 0 42 42" className="w-full h-full">
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#30363d" strokeWidth="4" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f7931a" strokeWidth="4"
                strokeDasharray={`${btcDom} ${100 - btcDom}`} strokeDashoffset="25" />
              <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#627eea" strokeWidth="4"
                strokeDasharray={`${ethDom} ${100 - ethDom}`} strokeDashoffset={`${25 - btcDom}`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="font-mono text-xs font-bold text-text-primary">{btcDom.toFixed(1)}%</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#f7931a]" />
              <span className="text-text-secondary text-xs">BTC {btcDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#627eea]" />
              <span className="text-text-secondary text-xs">ETH {ethDom.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#30363d]" />
              <span className="text-text-secondary text-xs">Other {(100 - btcDom - ethDom).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Top by Market Cap</h3>
        <div className="space-y-2">
          {topCoins.map((coin, i) => (
            <div key={coin.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-text-secondary text-xs w-4">{i + 1}</span>
                <img src={coin.image} alt={coin.name} className="w-5 h-5 rounded-full" />
                <span className="text-text-primary text-sm">{coin.name}</span>
                <span className="text-text-secondary text-xs font-mono">#{coin.market_cap_rank}</span>
              </div>
              <span className="font-mono text-sm text-text-primary">${(coin.market_cap / 1e9).toFixed(1)}B</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
