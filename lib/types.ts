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
// Dashboard State
// ============================================================

export interface DashboardData {
  crypto: CryptoIndicators[];
  polymarket: PolymarketData;
  briefing?: AIBriefing;
  lastUpdated: string;
}
