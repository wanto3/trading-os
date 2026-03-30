// ============================================================
// Core Types
// ============================================================

export interface CryptoPrice {
  symbol: string;
  price: number;
  change24h: number;
  change1h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdated: string;
}

export interface OHLCV {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export interface FundingRate {
  symbol: string;
  rate: number;
  nextFundingTime: number;
}

export interface OpenInterest {
  symbol: string;
  openInterest: number;
  change24h: number;
}

export interface FearGreedData {
  value: number;
  classification: string;
  lastUpdated: string;
}

export interface BTCDominance {
  value: number;
  lastUpdated: string;
}

// ============================================================
// Technical Indicators
// ============================================================

export type SignalLevel = "bullish" | "bearish" | "neutral" | "watch";

export interface IndicatorSignal {
  name: string;
  value: string | number;
  plainEnglish: string;
  action: string;
  level: SignalLevel;
  emoji: string;
}

export interface RSIData {
  value: number;
  signal: IndicatorSignal;
}

export interface MACDData {
  macdLine: number;
  signalLine: number;
  histogram: number;
  crossover: "bullish" | "bearish" | "none";
  signal: IndicatorSignal;
}

export interface BollingerData {
  upper: number;
  middle: number;
  lower: number;
  position: "squeezed" | "extended_up" | "extended_down" | "normal";
  bandwidth: number;
  percentB: number;
  signal: IndicatorSignal;
}

export interface VolumeProfile {
  upVolume: number;
  downVolume: number;
  percentUp: number;
  trend: "accumulating" | "distributing" | "neutral";
  signal: IndicatorSignal;
}

export interface VWAPData {
  value: number;
  above: boolean;
  signal: IndicatorSignal;
}

export interface SMAMovingAverage {
  value: number;
  above: boolean;
  signal: IndicatorSignal;
}

export interface CryptoIndicators {
  symbol: string;
  price: CryptoPrice;
  rsi: RSIData;
  macd: MACDData;
  bollinger: BollingerData;
  volumeProfile: VolumeProfile;
  vwap: VWAPData;
  sma200: SMAMovingAverage;
  fearGreed: FearGreedData;
  btcDominance: BTCDominance;
  fundingRate?: FundingRate;
  openInterest?: OpenInterest;
  lastUpdated: string;
}

// ============================================================
// Polymarket Types
// ============================================================

export interface PolymarketMarket {
  id: string;
  question: string;
  slug: string;
  description: string;
  outcomes: string[];
  outcomePrices: string[];
  volume: number;
  liquidity: number;
  volumeNum: number;
  liquidityNum: number;
  startDate: string;
  endDate: string;
  resolved: boolean;
  closed: boolean;
  me王朝?: string; // probability as string
  oddsChange1h?: number;
  oddsChange24h?: number;
  // Computed
  urgency?: number; // hours until resolution
  volumeSurge?: boolean;
  edgeSignal?: number; // gap between current odds and historical resolution rate
}

export interface PolymarketData {
  markets: PolymarketMarket[];
  trending: PolymarketMarket[];
  lastUpdated: string;
}

// ============================================================
// AI Briefing
// ============================================================

export interface BriefingTrade {
  market: string;
  odds: string;
  conviction: "high" | "medium" | "low";
  reason: string;
  urgency_hours: number; // hours until resolution
  action: string;
}

export interface AIBriefing {
  summary: string;
  topConvictionTrades: BriefingTrade[];
  quickSignals: string[];
  risks: string[];
  timestamp: string;
}

// ============================================================
// Signal Cards
// ============================================================

export type SignalCardLevel = "bullish" | "bearish" | "neutral" | "watch";

export interface SignalCard {
  id: string;
  name: string;
  emoji: string;
  value: string;
  subValue?: string;
  label: string;
  plainEnglish: string;
  action: string;
  level: SignalCardLevel;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface MvrvData {
  ratio: number;
  ratioChange7d: number;
  zScore: number;
  zone: string;
  zoneLabel: string;
  signal: "buy" | "sell" | "hold";
  signalLabel: string;
  signalReason: string;
  btcPrice: number;
  marketCap: number;
  realizedCap: number;
  timestamp: number;
}

export interface PiCycleData {
  piCycleTopTriggered: boolean;
  piCycleTopCrossPrice: number | null;
  piCycleTopEstTriggerPrice: number | null;
  ma111: number;
  ma111_2: number;
  btcPrice: number;
  compositeScore: number;
  compositeSignal: "buy" | "sell" | "hold";
  compositeSignalLabel: string;
  compositeSignalReason: string;
  components: { name: string; value: number; label: string }[];
  cyclePhase: string;
  cyclePhaseLabel: string;
  timestamp: number;
}

export interface EtfFlowsData {
  btc: { totalNetFlow7d: number; consecutiveInflowDays: number; avgVolume7d: number; latestPriceChange: number };
  eth: { totalNetFlow7d: number; consecutiveInflowDays: number; avgVolume7d: number; latestPriceChange: number };
  signal: "bullish" | "bearish" | "neutral";
  signalLabel: string;
  signalReason: string;
  btcPriceChange24h: number;
  timestamp: number;
}

export interface FdvToken {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  fdv: number;
  circulatingMarketCap: number;
  ratio: number;
  hiddenSellPressure: number;
  priceChange24h: number;
  riskLevel: string;
  rank: number;
}

export interface FdvRatioData {
  tokens: FdvToken[];
  signal: "buy" | "sell" | "hold";
  signalReason: string;
  highRiskCount: number;
  timestamp: number;
}

export interface TokenUnlock {
  id: string;
  symbol: string;
  name: string;
  unlockDate: string;
  amount: number;
  value: number;
  daysUntil: number;
}

export interface TokenUnlocksData {
  unlocks: TokenUnlock[];
  totalUpcomingValue: number;
  shockIndex: string;
  signal: "buy" | "sell" | "hold";
  signalLabel: string;
  signalReason: string;
  timestamp: number;
}

export interface FearBannerData {
  value: number;
  classification: string;
  action: string;
  signal: "buy" | "sell" | "hold";
  signalReason: string;
}

// ============================================================
// Dashboard State
// ============================================================

export interface DashboardData {
  crypto: CryptoIndicators[];
  polymarket: PolymarketData;
  briefing?: AIBriefing;
  lastUpdated: string;
}
