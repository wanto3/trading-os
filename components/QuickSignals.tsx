"use client";

interface Signal {
  text: string;
  level: "bullish" | "bearish" | "watch" | "neutral";
  source: string;
}

interface Props {
  signals: Signal[];
}

export default function QuickSignals({ signals }: Props) {
  // Deduplicate by text
  const unique = signals.filter(
    (s, i) => signals.findIndex((x) => x.text === s.text) === i
  );

  // Sort: bearish first, then watch, then bullish, then neutral
  const levelOrder = { bearish: 0, watch: 1, bullish: 2, neutral: 3 };
  unique.sort((a, b) => levelOrder[a.level] - levelOrder[b.level]);

  if (unique.length === 0) return null;

  return (
    <section className="bg-surface border border-border rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">
          Quick Signals
        </span>
        <span className="text-xs text-text-muted font-mono">{unique.length} active</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {unique.map((signal, i) => (
          <SignalBadge key={i} signal={signal} />
        ))}
      </div>
    </section>
  );
}

function SignalBadge({ signal }: { signal: Signal }) {
  const configs = {
    bullish: {
      bg: "bg-bullish-bg border-bullish/30 text-bullish",
      dot: "bg-bullish",
    },
    bearish: {
      bg: "bg-bearish-bg border-bearish/30 text-bearish",
      dot: "bg-bearish",
    },
    watch: {
      bg: "bg-warning-bg border-warning/30 text-warning",
      dot: "bg-warning",
    },
    neutral: {
      bg: "bg-muted/20 border-border text-text-secondary",
      dot: "bg-text-muted",
    },
  };

  const c = configs[signal.level];

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${c.bg}`}
      title={`${signal.source}: ${signal.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      <span>{signal.text}</span>
      <span className="text-text-muted text-xs ml-1">[{signal.source}]</span>
    </div>
  );
}
