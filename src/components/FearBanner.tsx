import { useFearGreed } from '../hooks/useFearGreed';
import { TrendingUp, TrendingDown, AlertTriangle, ShieldCheck } from 'lucide-react';

export type SignalStrength = 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';

export function getSignalStrength(value: number): SignalStrength {
  if (value <= 25) return 'strong_buy';
  if (value <= 45) return 'buy';
  if (value <= 55) return 'neutral';
  if (value <= 75) return 'sell';
  return 'strong_sell';
}

const BANNER_CONFIG: Record<SignalStrength, {
  label: string;
  subtext: string;
  bgFrom: string;
  bgTo: string;
  border: string;
  textColor: string;
  icon: React.ReactNode;
  visible: boolean;
}> = {
  strong_buy: {
    label: 'STRONG BUY — Accumulation Zone',
    subtext: 'Extreme fear historically precedes strong reversals. High-conviction entry point.',
    bgFrom: 'from-emerald-950',
    bgTo: 'to-emerald-900',
    border: 'border-emerald-500/40',
    textColor: 'text-emerald-300',
    icon: <ShieldCheck size={18} className="text-emerald-400 shrink-0" />,
    visible: true,
  },
  buy: {
    label: 'BUY — Fear Zone',
    subtext: 'Market sentiment is fearful. Opportunistic accumulation window.',
    bgFrom: 'from-amber-950',
    bgTo: 'to-amber-900',
    border: 'border-amber-500/40',
    textColor: 'text-amber-300',
    icon: <TrendingUp size={18} className="text-amber-400 shrink-0" />,
    visible: true,
  },
  neutral: {
    label: 'NEUTRAL — Balanced Market',
    subtext: 'Sentiment is balanced. No strong directional conviction.',
    bgFrom: 'from-neutral-900',
    bgTo: 'to-neutral-800',
    border: 'border-neutral-600/40',
    textColor: 'text-neutral-300',
    icon: <AlertTriangle size={18} className="text-neutral-400 shrink-0" />,
    visible: false, // don't show banner for neutral
  },
  sell: {
    label: 'TAKE PROFIT — Greed Zone',
    subtext: 'Market sentiment is greedy. Consider taking profits.',
    bgFrom: 'from-orange-950',
    bgTo: 'to-orange-900',
    border: 'border-orange-500/40',
    textColor: 'text-orange-300',
    icon: <TrendingDown size={18} className="text-orange-400 shrink-0" />,
    visible: true,
  },
  strong_sell: {
    label: 'EXTREME GREED — Reduce Risk',
    subtext: 'Extreme greed historically precedes corrections. De-risk positions.',
    bgFrom: 'from-red-950',
    bgTo: 'to-red-900',
    border: 'border-red-500/40',
    textColor: 'text-red-300',
    icon: <TrendingDown size={18} className="text-red-400 shrink-0" />,
    visible: true,
  },
};

export function FearBanner() {
  const { data, loading } = useFearGreed();

  if (loading || !data) return null;

  const signal = getSignalStrength(data.value);
  const config = BANNER_CONFIG[signal];

  if (!config.visible) return null;

  return (
    <div
      className={`rounded-lg border px-4 py-2.5 bg-gradient-to-r ${config.bgFrom} ${config.bgTo} ${config.border} flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3`}
    >
      <div className="flex items-center gap-2">
        {config.icon}
        <span className={`font-bold text-sm sm:text-base tracking-wide ${config.textColor}`}>
          {config.label}
        </span>
      </div>
      <p className={`text-xs ${config.textColor} opacity-80 leading-snug`}>
        {config.subtext}
      </p>
    </div>
  );
}
