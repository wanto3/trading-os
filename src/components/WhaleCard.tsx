import { useWhaleMetrics, formatLargeNumber } from '../hooks/useWhaleMetrics';
import { TrendingUp, TrendingDown, Minus, Fish } from 'lucide-react';

function signalColor(signal: 'bullish' | 'bearish' | 'neutral'): string {
  switch (signal) {
    case 'bullish': return 'text-signal-buy';
    case 'bearish': return 'text-signal-sell';
    default: return 'text-gray-400';
  }
}

function signalBg(signal: 'bullish' | 'bearish' | 'neutral'): string {
  switch (signal) {
    case 'bullish': return 'bg-signal-buy/10 border-signal-buy/20';
    case 'bearish': return 'bg-signal-sell/10 border-signal-sell/20';
    default: return 'bg-gray-500/10 border-gray-500/20';
  }
}

function accumulationBar(accum: number): { width: string; color: string } {
  const pct = Math.round(accum * 100);
  let color = 'bg-signal-buy';
  if (accum < 0.35) color = 'bg-signal-sell';
  else if (accum < 0.5) color = 'bg-yellow-400';
  else if (accum >= 0.7) color = 'bg-signal-buy';
  else color = 'bg-blue-400';
  return { width: `${pct}%`, color };
}

function WhaleMetricRow({ label, accum, flow, activeAddrs }: {
  label: string;
  accum: number;
  flow: number;
  activeAddrs: number;
}) {
  const { width, color } = accumulationBar(accum);
  const flowPositive = flow >= 0;

  return (
    <div className="mb-2 pb-2 border-b border-dark-border last:border-0 last:mb-0 last:pb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-400">{label}</span>
        <span className={`text-xs font-mono font-semibold ${signalColor(accum >= 0.5 ? 'bullish' : accum >= 0.35 ? 'neutral' : 'bearish')}`}>
          {(accum * 100).toFixed(0)}%
        </span>
      </div>
      {/* Accumulation bar */}
      <div className="relative h-1.5 bg-dark-base rounded-full overflow-hidden mb-1">
        <div
          className={`absolute left-0 top-0 h-full rounded-full transition-all ${color}`}
          style={{ width }}
        />
      </div>
      {/* Flow + addresses */}
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-gray-500">
          Flow: <span className={flowPositive ? 'text-signal-sell' : 'text-signal-buy'}>
            {flowPositive ? '+' : ''}{formatLargeNumber(flow)}/day
          </span>
        </span>
        <span className="text-[10px] text-gray-500">
          {activeAddrs >= 1e6
            ? `${(activeAddrs / 1e6).toFixed(1)}M addrs`
            : `${(activeAddrs / 1e3).toFixed(0)}K addrs`}
        </span>
      </div>
    </div>
  );
}

export function WhaleCard() {
  const { data, loading, error } = useWhaleMetrics();

  if (loading) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4 animate-pulse">
        <div className="h-4 bg-dark-muted rounded w-36 mb-3" />
        <div className="space-y-2">
          <div className="h-3 bg-dark-muted rounded w-48" />
          <div className="h-3 bg-dark-muted rounded w-40" />
          <div className="h-3 bg-dark-muted rounded w-36" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-dark-card border border-dark-border rounded-xl p-4">
        <div className="text-xs text-gray-500 font-mono mb-2">WHALE TRACKING</div>
        <p className="text-gray-400 text-sm">Data unavailable</p>
      </div>
    );
  }

  const SignalIcon = data.combinedSignal === 'bullish' ? TrendingUp
    : data.combinedSignal === 'bearish' ? TrendingDown
    : Minus;

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4 transition-all duration-200 hover:border-dark-muted">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <Fish size={12} className="text-blue-400" />
          <div>
            <div className="text-xs text-gray-500 font-mono uppercase tracking-wider">Whale Tracking</div>
            <div className="text-[10px] text-gray-600 mt-0.5">On-Chain Whale Activity</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <SignalIcon size={14} className={signalColor(data.combinedSignal)} />
          <span className={`text-xs font-semibold ${signalColor(data.combinedSignal)}`}>
            {data.combinedLabel}
          </span>
        </div>
      </div>

      {/* Combined score */}
      <div className="mb-3">
        <div className="flex justify-between items-baseline mb-1">
          <span className="text-xs text-gray-400">Whale Score</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-mono font-bold ${signalColor(data.combinedSignal)}`}>
              {data.combinedScore > 0 ? '+' : ''}{data.combinedScore}
            </span>
            <span className={`text-xs font-mono ${data.combinedScore >= 0 ? 'text-signal-buy' : 'text-signal-sell'}`}>
              {data.combinedScore >= 0 ? 'accumulating' : 'distributing'}
            </span>
          </div>
        </div>
        {/* Score bar */}
        <div className="relative h-2 bg-dark-base rounded-full overflow-hidden">
          {/* Center line */}
          <div className="absolute left-1/2 top-0 h-full w-px bg-gray-600 opacity-50" />
          {/* Accumulation fill (from center right) */}
          <div
            className={`absolute top-0 h-full rounded-full transition-all ${data.combinedScore >= 0 ? 'bg-signal-buy' : 'bg-signal-sell'}`}
            style={{
              left: data.combinedScore >= 0 ? '50%' : `${50 + (data.combinedScore)}%`,
              width: `${Math.abs(data.combinedScore) / 2}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[10px] text-gray-600">Distribution</span>
          <span className="text-[10px] text-gray-600">Accumulation</span>
        </div>
      </div>

      {/* BTC + ETH whale metrics */}
      <div className="mb-3 pb-3 border-b border-dark-border">
        <div className="grid grid-cols-2 gap-3">
          <WhaleMetricRow
            label="BTC Whales"
            accum={data.btc.whaleAccumulation}
            flow={data.btc.exchangeNetFlow}
            activeAddrs={data.btc.activeAddresses}
          />
          <WhaleMetricRow
            label="ETH Whales"
            accum={data.eth.whaleAccumulation}
            flow={data.eth.exchangeNetFlow}
            activeAddrs={data.eth.activeAddresses}
          />
        </div>
      </div>

      {/* Supply distribution + large tx volume */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-400">BTC Supply Dist.</span>
          <span className={`text-xs font-mono ${
            data.btc.supplyDistribution === 'accumulation' ? 'text-signal-buy' :
            data.btc.supplyDistribution === 'distribution' ? 'text-signal-sell' : 'text-gray-400'
          }`}>
            {data.btc.supplyDistribution.charAt(0).toUpperCase() + data.btc.supplyDistribution.slice(1)}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-xs text-gray-400">Large Tx Volume (24h)</span>
          <span className="text-xs font-mono text-gray-300">
            {formatLargeNumber(data.btc.largeTxVolume24h)}
          </span>
        </div>
      </div>

      {/* Signal interpretation */}
      <div className={`rounded p-2 mb-2 border ${signalBg(data.combinedSignal)}`}>
        <div className="text-xs text-gray-300 leading-relaxed">
          {data.combinedReason}
        </div>
      </div>

      {/* BTC whale reason */}
      <div className="bg-dark-base rounded p-2 mb-2">
        <div className="text-[10px] text-gray-500 leading-relaxed">
          BTC: {data.btc.signalReason}
        </div>
        <div className="text-[10px] text-gray-500 leading-relaxed mt-0.5">
          ETH: {data.eth.signalReason}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-gray-600">Source: Blockchain.com + CoinGecko</span>
        <span className="text-[10px] text-gray-600">15min</span>
      </div>
    </div>
  );
}
