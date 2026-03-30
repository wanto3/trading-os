import { useEffect, useState } from 'react';
import { useCoin } from '../context/CoinContext';
import { getOhlc } from '../lib/coingecko';
import { macdValueToStrength } from '../hooks/useSignalSynthesis';

type SignalDir = 'bull' | 'bear' | 'neutral';

interface TimeframeSignal {
  label: string;
  interval: number;  // days for CoinGecko OHLC
  signal: SignalDir;
  confidence: number;  // 0-100
  rsi: number | null;
  macdDir: SignalDir;
}

function calculateRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain = changes.slice(0, period).filter(c => c > 0).reduce((a, b) => a + b, 0) / period;
  let avgLoss = Math.abs(changes.slice(0, period).filter(c => c < 0).reduce((a, b) => a + b, 0)) / period;
  for (let i = period; i < changes.length; i++) {
    const gain = changes[i] > 0 ? changes[i] : 0;
    const loss = Math.abs(changes[i] < 0 ? changes[i] : 0);
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
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

function computeSignal(closes: number[]): { rsi: number | null; macdDir: SignalDir } {
  if (closes.length < 30) return { rsi: null, macdDir: 'neutral' };
  const rsi = calculateRSI(closes);
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  if (ema12.length === 0 || ema26.length === 0) return { rsi, macdDir: 'neutral' };
  const last12 = ema12[ema12.length - 1];
  const last26 = ema26[ema26.length - 1];
  const strength = macdValueToStrength(last12, last26);
  const macdDir: SignalDir = strength === 'bullish' ? 'bull' : strength === 'bearish' ? 'bear' : 'neutral';
  return { rsi, macdDir };
}

function aggregateSignal(tfSignals: TimeframeSignal[]): { direction: SignalDir; confidence: number; totalSignals: number } {
  let bull = 0, bear = 0, neutral = 0;
  let totalWeight = 0;
  tfSignals.forEach((s, i) => {
    const weight = [4, 4, 3, 3][i] ?? 1;  // weight by timeframe importance
    if (s.signal === 'bull') bull += weight;
    else if (s.signal === 'bear') bear += weight;
    else neutral += weight;
    totalWeight += weight;
  });
  const bullPct = (bull / totalWeight) * 100;
  const bearPct = (bear / totalWeight) * 100;
  const direction: SignalDir = bullPct > bearPct + 15 ? 'bull' : bearPct > bullPct + 15 ? 'bear' : 'neutral';
  const confidence = Math.max(bullPct, bearPct, neutral / tfSignals.length * 100);
  return { direction, confidence, totalSignals: tfSignals.length };
}

function signalColor(dir: SignalDir): string {
  if (dir === 'bull') return '#3fb950';
  if (dir === 'bear') return '#f85149';
  return '#d29922';
}

function signalBg(dir: SignalDir): string {
  if (dir === 'bull') return 'bg-[#0d3b1e]';
  if (dir === 'bear') return 'bg-[#3b1a1a]';
  return 'bg-[#3b2e0a]';
}

function TimeframeCard({ tf }: { tf: TimeframeSignal }) {
  const color = signalColor(tf.signal);
  return (
    <div className={`rounded-lg p-3 border ${tf.signal === 'bull' ? 'border-[#3fb950]/30' : tf.signal === 'bear' ? 'border-[#f85149]/30' : 'border-[#d29922]/30'} ${signalBg(tf.signal)}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-text-primary text-xs font-bold">{tf.label}</span>
        <span
          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
        >
          {tf.signal.toUpperCase()}
        </span>
      </div>
      <div className="flex items-end justify-between">
        <span className="font-mono text-xl font-bold" style={{ color }}>
          {tf.confidence}%
        </span>
        <div className="text-right">
          {tf.rsi !== null && (
            <span className="font-mono text-[10px] text-text-secondary block">
              RSI: {tf.rsi.toFixed(1)}
            </span>
          )}
          <span className="font-mono text-[10px] text-text-secondary block capitalize">
            MACD: {tf.macdDir}
          </span>
        </div>
      </div>
    </div>
  );
}

export function SignalRadar() {
  const { selectedCoinId } = useCoin();
  const [timeframes, setTimeframes] = useState<TimeframeSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // CoinGecko OHLC intervals: 1=hourly, 7=4h, 30=daily, 90=weekly
        // For meaningful RSI per timeframe, need enough data points
        const tfConfigs: Array<{ label: string; interval: number; daysNeeded: number }> = [
          { label: '1H', interval: 1, daysNeeded: 60 },
          { label: '4H', interval: 7, daysNeeded: 90 },
          { label: '1D', interval: 30, daysNeeded: 180 },
          { label: '1W', interval: 90, daysNeeded: 365 },
        ];

        const signals = await Promise.all(
          tfConfigs.map(async ({ label, interval, daysNeeded }) => {
            try {
              const ohlcData = await getOhlc(selectedCoinId, daysNeeded);
              // CoinGecko OHLC returns: [timestamp, open, high, low, close]
              // Filter to the right interval (approx)
              const closes = ohlcData
                .filter((_, i) => i % Math.max(1, Math.floor(interval / 1)) === 0)
                .map(d => {
                  const n = Number(d[4]);
                  return isNaN(n) ? 0 : n;
                });
              const { rsi, macdDir } = computeSignal(closes);

              // Determine signal direction from RSI + MACD
              let signal: SignalDir = 'neutral';
              let confidence = 50;

              if (rsi !== null) {
                const bullScore = (rsi < 40 ? (40 - rsi) / 40 * 30 : 0) + (macdDir === 'bull' ? 30 : macdDir === 'neutral' ? 15 : 0);
                const bearScore = (rsi > 60 ? (rsi - 60) / 40 * 30 : 0) + (macdDir === 'bear' ? 30 : macdDir === 'neutral' ? 15 : 0);
                if (bullScore > bearScore + 15) { signal = 'bull'; confidence = 50 + bullScore; }
                else if (bearScore > bullScore + 15) { signal = 'bear'; confidence = 50 + bearScore; }
                else confidence = 50 + Math.max(bullScore, bearScore);
              }

              return { label, interval, signal, confidence: Math.min(95, Math.max(30, confidence)), rsi, macdDir };
            } catch {
              return { label, interval, signal: 'neutral' as SignalDir, confidence: 50, rsi: null, macdDir: 'neutral' as SignalDir };
            }
          })
        );

        if (!cancelled) setTimeframes(signals);
      } catch {
        // silent fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedCoinId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-[#58a6ff] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (timeframes.length === 0) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-text-secondary text-xs">No signal data available</p>
      </div>
    );
  }

  const aggregate = aggregateSignal(timeframes);
  const aggColor = signalColor(aggregate.direction);
  const aggLabel = aggregate.direction === 'bull' ? 'BULLISH' : aggregate.direction === 'bear' ? 'BEARISH' : 'NEUTRAL';

  return (
    <div className="space-y-4">
      {/* Summary Badge */}
      <div className={`rounded-lg p-3 border ${aggregate.direction === 'bull' ? 'border-[#3fb950]/40' : aggregate.direction === 'bear' ? 'border-[#f85149]/40' : 'border-[#d29922]/40'} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-2xl font-bold" style={{ color: aggColor }}>
            {aggregate.confidence.toFixed(0)}%
          </span>
          <div>
            <p className="text-text-primary text-sm font-bold">{aggLabel}</p>
            <p className="text-text-secondary text-[10px]">Multi-timeframe composite</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {timeframes.map(tf => (
            <div
              key={tf.label}
              className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold"
              style={{
                background: `${signalColor(tf.signal)}30`,
                color: signalColor(tf.signal),
                border: `1px solid ${signalColor(tf.signal)}50`,
              }}
              title={`${tf.label}: ${tf.signal.toUpperCase()} ${tf.confidence}%`}
            >
              {tf.label.replace('H', '').replace('D', 'd').replace('W', 'w')}
            </div>
          ))}
        </div>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-2 gap-3">
        {timeframes.map(tf => (
          <TimeframeCard key={tf.label} tf={tf} />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-[10px] text-text-secondary">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#3fb950]" />
          Bullish
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#d29922]" />
          Neutral
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#f85149]" />
          Bearish
        </span>
      </div>
    </div>
  );
}