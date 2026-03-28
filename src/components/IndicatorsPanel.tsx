import { useEffect, useState } from 'react';
import { getOhlc } from '../lib/coingecko';
import { useCoin } from '../context/CoinContext';

function calculateRSI(closes: number[], period = 14): number[] {
  if (closes.length < period + 1) return [];
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = Math.abs(changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  const rsi: number[] = [];

  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = Math.abs(changes[i] < 0 ? changes[i] : 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }
  return rsi;
}

function calculateEMA(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let sum = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(sum);
  for (let i = period; i < values.length; i++) {
    sum = values[i] * k + sum * (1 - k);
    ema.push(sum);
  }
  return ema;
}

export function IndicatorsPanel() {
  const { selectedCoinId } = useCoin();
  const [rsi, setRsi] = useState<number[]>([]);
  const [macdLine, setMacdLine] = useState<number[]>([]);
  const [signalLine, setSignalLine] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await getOhlc(selectedCoinId, 30);
        const closes = data.map(d => d.close);
        const rsiValues = calculateRSI(closes);
        setRsi(rsiValues.slice(-30));

        const ema12 = calculateEMA(closes, 12);
        const ema26 = calculateEMA(closes, 26);
        const macd = closes.map((_, i) => (ema12[i] || 0) - (ema26[i] || 0));
        setMacdLine(macd.slice(-30));
        const signal = calculateEMA(macd, 9);
        setSignalLine(signal);
      } catch (e) {
        // silent fail
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedCoinId]);

  if (loading) return <div className="text-text-secondary text-sm">Loading indicators...</div>;

  const latestRsi = rsi[rsi.length - 1] || 0;
  const rsiColor = latestRsi > 70 ? '#f85149' : latestRsi < 30 ? '#3fb950' : '#58a6ff';

  const latestMacd = macdLine[macdLine.length - 1] || 0;
  const latestSignal = signalLine[signalLine.length - 1] || 0;
  const macdHistogram = macdLine.map((m, i) => m - (signalLine[i] || 0));

  return (
    <div className="space-y-6">
      <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider">RSI (14)</h3>
          <span className="font-mono text-lg font-bold" style={{ color: rsiColor }}>{latestRsi.toFixed(1)}</span>
        </div>
        <div className="relative h-8 bg-bg-surface rounded overflow-hidden">
          <div className="absolute inset-x-0 top-1/2 h-px bg-border-subtle" />
          {rsi.map((v, i) => (
            <div
              key={i}
              className="absolute w-1 bottom-0"
              style={{
                left: `${(i / rsi.length) * 100}%`,
                height: `${Math.min(v, 100)}%`,
                background: v > 70 ? '#f85149' : v < 30 ? '#3fb950' : '#58a6ff',
                opacity: 0.7,
              }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-text-secondary text-xs">0</span>
          <span className="text-text-secondary text-xs">30 (oversold)</span>
          <span className="text-text-secondary text-xs">70 (overbought)</span>
          <span className="text-text-secondary text-xs">100</span>
        </div>
      </div>

      <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-2">MACD (12, 26, 9)</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-text-secondary text-xs">MACD Line</span>
            <span className={`font-mono text-sm font-semibold ${latestMacd >= 0 ? 'text-gain' : 'text-loss'}`}>
              {latestMacd.toFixed(4)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary text-xs">Signal Line</span>
            <span className="font-mono text-sm font-semibold text-accent">{latestSignal.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary text-xs">Histogram</span>
            <span className={`font-mono text-sm font-semibold ${macdHistogram[macdHistogram.length - 1] >= 0 ? 'text-gain' : 'text-loss'}`}>
              {(macdHistogram[macdHistogram.length - 1] || 0).toFixed(4)}
            </span>
          </div>
        </div>
        {macdHistogram.length > 0 && (
          <div className="mt-3 flex items-end gap-px h-12">
            {macdHistogram.map((v, i) => (
              <div
                key={i}
                className="flex-1"
                style={{
                  height: `${Math.min(Math.abs(v) / (Math.max(...macdHistogram.map(Math.abs)) || 1) * 100, 100)}%`,
                  background: v >= 0 ? '#3fb950' : '#f85149',
                  opacity: 0.6,
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="bg-bg-primary rounded-lg p-4 border border-border-subtle">
        <h3 className="text-text-secondary text-xs font-semibold uppercase tracking-wider mb-3">Moving Averages</h3>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'SMA 20', period: 20 },
            { label: 'SMA 50', period: 50 },
            { label: 'SMA 200', period: 200 },
          ].map(ma => (
            <div key={ma.label} className="text-center">
              <p className="text-text-secondary text-xs">{ma.label}</p>
              <p className="font-mono text-sm font-semibold text-text-primary mt-1">--</p>
              <p className="text-text-secondary text-xs">Enable chart overlay</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
