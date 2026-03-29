import { useState, useEffect, useCallback } from 'react';
import { CoinProvider, useCoin } from './context/CoinContext';
import { useWatchlist } from './hooks/useWatchlist';
import { useAlerts } from './hooks/useAlerts';
import { useFearGreed } from './hooks/useFearGreed';
import { Header } from './components/Header';
import { Watchlist } from './components/Watchlist';
import { CandlestickChart } from './components/CandlestickChart';
import { IndicatorsPanel } from './components/IndicatorsPanel';
import { NewsPanel } from './components/NewsPanel';
import { PredictionsPanel } from './components/PredictionsPanel';
import { AlertModal } from './components/AlertModal';
import { Toast } from './components/Toast';
import { getMarketCoins, getGlobalData, searchCoins } from './lib/coingecko';
import type { CoinMarket, GlobalData } from './lib/coingecko';

function FearGreedBadge({ value, classification }: { value: number; classification: string }) {
  const color = value <= 25 ? '#f85149' : value <= 45 ? '#f0883e' : value <= 55 ? '#d29922' : value <= 75 ? '#3fb950' : '#2ea043';
  return (
    <div className="flex items-center gap-2">
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
          <circle cx="21" cy="21" r="16" fill="none" stroke="#30363d" strokeWidth="4" />
          <circle cx="21" cy="21" r="16" fill="none" stroke={color} strokeWidth="4"
            strokeDasharray={`${(value / 100) * 100.5} ${100.5 - (value / 100) * 100.5}`}
            strokeDashoffset="0"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] font-bold" style={{ color }}>{value}</span>
      </div>
      <div>
        <p className="text-[10px] font-semibold" style={{ color }}>{classification}</p>
        <p className="text-[9px] text-text-secondary">Fear & Greed</p>
      </div>
    </div>
  );
}

function Dashboard() {
  const { selectedCoinId, setSelectedCoinId } = useCoin();
  const { favorites, toggleFavorite } = useWatchlist();
  const { alerts, addAlert, removeAlert } = useAlerts();
  const [coins, setCoins] = useState<CoinMarket[]>([]);
  const [globalData, setGlobalData] = useState<GlobalData['data'] | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; symbol: string; thumb: string }>>([]);
  const [alertModalCoin, setAlertModalCoin] = useState<CoinMarket | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<'indicators' | 'news' | 'predictions'>('indicators');
  const [, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMarketCoins(1, 50), getGlobalData()])
      .then(([coinsData, global]) => {
        setCoins(coinsData);
        setGlobalData(global.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => {
      searchCoins(searchQuery).then(r => setSearchResults(r.coins.slice(0, 8))).catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!coins.length) return;
    const checkAlerts = setInterval(() => {
      alerts.forEach(alert => {
        if (alert.triggered) return;
        const coin = coins.find(c => c.id === alert.coinId);
        if (!coin) return;
        const triggered = alert.condition === 'above'
          ? coin.current_price >= alert.price
          : coin.current_price <= alert.price;
        if (triggered) {
          setToast(`${alert.coinName} is now ${alert.condition} $${alert.price}!`);
        }
      });
    }, 10000);
    return () => clearInterval(checkAlerts);
  }, [coins, alerts]);

  const handleSelectCoin = useCallback((id: string) => {
    setSelectedCoinId(id);
    setSearchQuery('');
    setSearchResults([]);
  }, [setSelectedCoinId]);

  const selectedCoin = coins.find(c => c.id === selectedCoinId);
  const btcCoin = coins.find(c => c.id === 'bitcoin');
  const ethCoin = coins.find(c => c.id === 'ethereum');
  const { data: fearGreedData } = useFearGreed();

  const totalMarketCap = globalData?.total_market_cap?.usd || 0;
  const totalVolume = globalData?.total_volume?.usd || 0;
  const btcDom = globalData?.market_cap_percentage?.btc || 0;
  const ethDom = globalData?.market_cap_percentage?.eth || 0;
  const marketChange = globalData?.market_cap_change_percentage_24h_usd || 0;

  const BOTTOM_TABS = [
    { id: 'indicators', label: 'Indicators' },
    { id: 'news', label: 'News' },
    { id: 'predictions', label: 'Predictions' },
  ] as const;

  return (
    <div className="h-screen flex flex-col bg-bg-primary overflow-hidden">
      <Header
        btcPrice={btcCoin?.current_price}
        btcChange={btcCoin?.price_change_percentage_24h}
        ethPrice={ethCoin?.current_price}
        ethChange={ethCoin?.price_change_percentage_24h}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchResults={searchResults}
        onSelectCoin={handleSelectCoin}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Watchlist sidebar */}
        <Watchlist
          coins={coins}
          favorites={favorites}
          onToggleFavorite={toggleFavorite}
          onSetAlert={setAlertModalCoin}
        />

        {/* Main dashboard */}
        <div className="flex-1 flex flex-col overflow-hidden p-3 gap-3">
          {/* Chart — fixed height, compact */}
          <div className="h-[38vh] shrink-0 rounded-lg overflow-hidden border border-border-subtle">
            <CandlestickChart key={selectedCoinId} />
          </div>

          {/* Dashboard stats strip — always visible above the fold */}
          <div className="grid grid-cols-4 gap-3 shrink-0">
            {/* Fear & Greed */}
            <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle flex items-center justify-center">
              {fearGreedData ? (
                <FearGreedBadge value={fearGreedData.value} classification={fearGreedData.classification} />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 border-2 border-border-subtle border-t-accent rounded-full animate-spin" />
                  <span className="text-text-secondary text-xs">Loading...</span>
                </div>
              )}
            </div>

            {/* Market Overview */}
            <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
              <p className="text-text-secondary text-[9px] uppercase tracking-wider font-semibold mb-1">Market Cap</p>
              <p className="font-mono text-sm font-bold text-text-primary leading-tight">
                ${totalMarketCap > 1e12 ? `${(totalMarketCap / 1e12).toFixed(2)}T` : `${(totalMarketCap / 1e9).toFixed(0)}B`}
              </p>
              <p className="text-text-secondary text-[9px] mt-1">24h Vol ${totalVolume > 1e9 ? `${(totalVolume / 1e9).toFixed(0)}B` : `${(totalVolume / 1e6).toFixed(0)}M`}</p>
              <p className={`font-mono text-sm font-bold mt-1 leading-tight ${marketChange >= 0 ? 'text-gain' : 'text-loss'}`}>
                {marketChange >= 0 ? '+' : ''}{marketChange.toFixed(2)}%
              </p>
            </div>

            {/* BTC Dominance */}
            <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
              <p className="text-text-secondary text-[9px] uppercase tracking-wider font-semibold mb-1">BTC Dominance</p>
              <p className="font-mono text-2xl font-bold text-text-primary leading-tight">{btcDom.toFixed(1)}%</p>
              <div className="h-1.5 rounded-full overflow-hidden flex mt-2">
                <div className="bg-[#f7931a]" style={{ width: `${btcDom}%` }} />
                <div className="bg-[#627eea]" style={{ width: `${ethDom}%` }} />
                <div className="bg-[#30363d] flex-1" />
              </div>
              <p className="text-[9px] text-text-secondary mt-1">ETH {ethDom.toFixed(1)}%</p>
            </div>

            {/* Selected Coin */}
            <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
              {selectedCoin ? (
                <>
                  <div className="flex items-center gap-1.5 mb-1">
                    <img src={selectedCoin.image} alt={selectedCoin.name} className="w-4 h-4 rounded-full" />
                    <p className="font-semibold text-text-primary text-xs">{selectedCoin.symbol.toUpperCase()}</p>
                    <span className="font-mono text-[9px] text-text-secondary">#{selectedCoin.market_cap_rank}</span>
                  </div>
                  <p className="font-mono text-sm font-bold text-text-primary leading-tight">${selectedCoin.current_price.toLocaleString()}</p>
                  <p className={`font-mono text-xs font-semibold leading-tight ${selectedCoin.price_change_percentage_24h >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {selectedCoin.price_change_percentage_24h >= 0 ? '+' : ''}{selectedCoin.price_change_percentage_24h?.toFixed(2)}%
                  </p>
                </>
              ) : (
                <p className="text-text-secondary text-xs">Select a coin</p>
              )}
            </div>
          </div>

          {/* Top 5 coins — always visible */}
          <div className="bg-bg-surface rounded-lg px-3 py-2 border border-border-subtle shrink-0">
            <p className="text-text-secondary text-[9px] uppercase tracking-wider font-semibold mb-1">Top by Market Cap</p>
            <div className="flex gap-4 overflow-hidden">
              {coins.slice(0, 8).map((coin, i) => (
                <div
                  key={coin.id}
                  className={`flex items-center gap-1 cursor-pointer px-1 py-0.5 rounded ${selectedCoinId === coin.id ? 'bg-accent/20' : 'hover:bg-bg-primary'} transition-colors shrink-0`}
                  onClick={() => handleSelectCoin(coin.id)}
                >
                  <span className="text-[9px] text-text-secondary w-3 text-center">{i + 1}</span>
                  <img src={coin.image} alt={coin.name} className="w-3.5 h-3.5 rounded-full" />
                  <span className="font-mono text-[10px] text-text-primary font-semibold">{coin.symbol.toUpperCase()}</span>
                  <span className={`font-mono text-[9px] ${coin.price_change_percentage_24h >= 0 ? 'text-gain' : 'text-loss'}`}>
                    {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Indicators / News / Predictions — tabbed below */}
          {selectedCoin && (
            <div className="flex-1 min-h-0 bg-bg-surface rounded-lg border border-border-subtle overflow-hidden flex flex-col">
              {/* Tab bar */}
              <div className="flex border-b border-border-subtle shrink-0">
                {BOTTOM_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setBottomTab(tab.id)}
                    className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                      bottomTab === tab.id
                        ? 'text-accent border-b-2 border-accent -mb-px'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-3">
                {bottomTab === 'indicators' && <IndicatorsPanel />}
                {bottomTab === 'news' && <NewsPanel />}
                {bottomTab === 'predictions' && <PredictionsPanel />}
              </div>
            </div>
          )}

          {!selectedCoin && (
            <div className="flex-1 flex items-center justify-center text-text-secondary text-sm">
              Select a coin from the watchlist to view details
            </div>
          )}
        </div>
      </div>

      {alertModalCoin && (
        <AlertModal
          coinName={alertModalCoin.id}
          coinSymbol={alertModalCoin.symbol}
          currentPrice={alertModalCoin.current_price}
          onSave={addAlert}
          onClose={() => setAlertModalCoin(null)}
          existingAlerts={alerts.filter(a => a.coinId === alertModalCoin.id)}
          onRemove={removeAlert}
        />
      )}

      {toast && (
        <Toast message={toast} type="alert" onDismiss={() => setToast(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <CoinProvider>
      <Dashboard />
    </CoinProvider>
  );
}
