import { useFundingRates } from '../hooks/useFundingRates';
import { RefreshCw } from 'lucide-react';

function getStatusColor(status: string, rate: number): { text: string; bg: string } {
  const isPositive = rate >= 0;
  if (status === 'extreme') {
    return isPositive
      ? { text: 'text-[#f85149]', bg: 'bg-[#f85149]/10' }
      : { text: 'text-[#3fb950]', bg: 'bg-[#3fb950]/10' };
  }
  if (status === 'warning') {
    return { text: 'text-[#d29922]', bg: 'bg-[#d29922]/10' };
  }
  return { text: 'text-[#8b949e]', bg: 'bg-[#30363d]/20' };
}

function getStatusLabel(status: string): string {
  if (status === 'extreme') return 'EXTREME';
  if (status === 'warning') return 'WARNING';
  return 'NORMAL';
}

function formatApr(apr: number): string {
  const abs = Math.abs(apr);
  const sign = apr >= 0 ? '+' : '-';
  if (abs >= 100) return `${sign}${abs.toFixed(1)}%`;
  if (abs >= 10) return `${sign}${abs.toFixed(2)}%`;
  return `${sign}${abs.toFixed(3)}%`;
}

function formatRate8h(rate: number): string {
  const pct = rate * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(4)}%`;
}

export function FundingRatesPanel() {
  const { data, loading, error, refetch } = useFundingRates();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2">
        <p className="text-text-secondary text-xs">Failed to load funding rates</p>
        <button onClick={refetch} className="text-xs text-accent hover:underline">Retry</button>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-text-secondary text-xs">No funding rate data available</p>
      </div>
    );
  }

  const { data: rates, averageApr } = data;

  return (
    <div className="space-y-3">
      {/* Average APR Banner */}
      <div className={`rounded-lg p-3 border ${averageApr >= 0 ? 'border-[#3fb950]/30 bg-[#0d3b1e]/50' : 'border-[#f85149]/30 bg-[#3b1a1a]/50'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-text-secondary text-[10px] mb-0.5">Average BTC Funding APR</p>
            <p className={`font-mono text-lg font-bold ${averageApr >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              {formatApr(averageApr)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-text-secondary text-[10px] mb-0.5">Signal</p>
            <p className={`text-xs font-semibold ${averageApr >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
              {averageApr >= 0 ? 'Longs Pay Shorts' : 'Shorts Pay Longs'}
            </p>
          </div>
          <button
            onClick={refetch}
            className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all"
            title="Refresh"
          >
            <RefreshCw size={12} />
          </button>
        </div>
        {/* Interpretation */}
        <p className="text-text-secondary text-[10px] mt-1.5">
          {averageApr > 0.1
            ? 'Extremely high funding — degen long sentiment. Take profit risk elevated.'
            : averageApr > 0.03
            ? 'Elevated funding — longs paying premium. Caution on leverage.'
            : averageApr > 0
            ? 'Slightly elevated — mild long bias in funding market.'
            : averageApr > -0.03
            ? 'Near neutral funding — balanced market.'
            : averageApr > -0.1
            ? 'Slightly negative — mild short bias in funding market.'
            : 'Extremely negative funding — degen short sentiment. Squeeze risk elevated.'}
        </p>
      </div>

      {/* Per-Exchange Table */}
      <div className="bg-bg-primary rounded-lg border border-border-subtle overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-subtle">
              <th className="text-left px-3 py-2 text-text-secondary text-[10px] font-semibold uppercase tracking-wider">Exchange</th>
              <th className="text-right px-3 py-2 text-text-secondary text-[10px] font-semibold uppercase tracking-wider">Rate / 8h</th>
              <th className="text-right px-3 py-2 text-text-secondary text-[10px] font-semibold uppercase tracking-wider">APR</th>
              <th className="text-right px-3 py-2 text-text-secondary text-[10px] font-semibold uppercase tracking-wider">Next Funding</th>
              <th className="text-center px-3 py-2 text-text-secondary text-[10px] font-semibold uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => {
              const colors = getStatusColor(rate.status, rate.ratePer8h);
              return (
                <tr key={rate.exchange} className="border-b border-border-subtle/50 last:border-0 hover:bg-bg-surface/50 transition-colors">
                  <td className="px-3 py-2">
                    <span className="text-text-primary text-xs font-semibold">{rate.exchange}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs ${rate.ratePer8h >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {formatRate8h(rate.ratePer8h)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs font-semibold ${rate.apr >= 0 ? 'text-gain' : 'text-loss'}`}>
                      {formatApr(rate.apr)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {rate.nextFundingTime ? (
                      <span className="font-mono text-[10px] text-text-secondary">
                        {new Date(rate.nextFundingTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-secondary/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${colors.text} ${colors.bg} ${colors.text.replace('text-', 'border-')}`}>
                      {getStatusLabel(rate.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <p className="text-text-secondary/50 text-[9px] text-center">
        Funding rates update every 8h on most exchanges. Data sourced from Binance, Bybit, OKX, Deribit, dYdX.
      </p>
    </div>
  );
}