const NEWS = [
  { title: "Bitcoin ETFs See Record Inflows as Institutional Interest Grows", source: "CoinDesk", time: "2h ago", sentiment: "positive" },
  { title: "Ethereum Network Upgrade Scheduled for Next Month", source: "The Block", time: "4h ago", sentiment: "positive" },
  { title: "Regulatory Scrutiny Intensifies for Stablecoin Issuers", source: "Bloomberg Crypto", time: "6h ago", sentiment: "negative" },
  { title: "DeFi Total Value Locked Reaches New All-Time High", source: "DeFi Pulse", time: "8h ago", sentiment: "positive" },
  { title: "Crypto Market Volatility Spikes Amid Macro Uncertainty", source: "Reuters", time: "12h ago", sentiment: "negative" },
  { title: "Layer 2 Solutions Process Record Transaction Volume", source: "L2Beat", time: "1d ago", sentiment: "neutral" },
  { title: "Major Exchange Announces Support for New Token Listings", source: "CoinGecko", time: "1d ago", sentiment: "neutral" },
  { title: "Mining Difficulty Adjustment Signals Healthier Network", source: "Bitcoin Magazine", time: "2d ago", sentiment: "positive" },
];

export function NewsPanel() {
  return (
    <div className="space-y-3">
      {NEWS.map((item, i) => (
        <div key={i} className="bg-bg-primary rounded-lg p-3 border border-border-subtle hover:border-accent/30 transition-colors cursor-pointer">
          <div className="flex items-start justify-between gap-2">
            <p className="text-text-primary text-sm leading-snug">{item.title}</p>
            <div className={`shrink-0 w-2 h-2 rounded-full mt-1.5 ${
              item.sentiment === 'positive' ? 'bg-gain' :
              item.sentiment === 'negative' ? 'bg-loss' : 'bg-text-secondary'
            }`} />
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-text-secondary text-xs">{item.source}</span>
            <span className="text-border-subtle text-xs">·</span>
            <span className="text-text-secondary text-xs">{item.time}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
