import { NextResponse } from 'next/server';

const CG_BASE = 'https://api.coingecko.com/api/v3';
const BINANCE_WS = 'https://api.binance.com';
const FG_BASE = 'https://api.alternative.me/fng';

type SentimentType = 'positive' | 'negative' | 'neutral';
type ConvictionLevel = 'high_bearish' | 'bearish' | 'neutral' | 'bullish' | 'high_bullish';
type MarketSentiment = 'extreme_fear' | 'fear' | 'neutral' | 'greed' | 'extreme_greed';
type NewsSignal = 'bullish' | 'bearish' | 'neutral';

interface ComponentSignal {
  name: string;
  score: number;
  weight: number;
  value: number;
  status: SentimentType;
}

interface AlphaSignalData {
  convictionScore: number;
  convictionLevel: ConvictionLevel;
  convictionLabel: string;
  confidence: number;
  reasoning: string;
  components: ComponentSignal[];
  marketSentiment: MarketSentiment;
  btcPrice: number;
  btcChange24h: number;
  newsSignal: NewsSignal;
  newsCount: number;
  timestamp: number;
}

const POSITIVE_KEYWORDS = ['surge', 'bullish', 'record', 'growth', 'adoption', 'approval', 'upgrade', 'rally', 'gain', 'soar', 'jump', 'boom', 'high', 'breakout', 'whale', 'accumulation', 'institutional'];
const NEGATIVE_KEYWORDS = ['crash', 'bearish', 'loss', 'drop', 'plunge', 'fall', 'decline', 'ban', 'hack', 'scam', 'risk', 'warn', 'selloff', 'fear', 'regulation', 'sell', 'capitulation', 'liquidation'];

function inferSentiment(title: string): SentimentType {
  const lower = title.toLowerCase();
  const posCount = POSITIVE_KEYWORDS.filter(k => lower.includes(k)).length;
  const negCount = NEGATIVE_KEYWORDS.filter(k => lower.includes(k)).length;
  if (posCount > negCount) return 'positive';
  if (negCount > posCount) return 'negative';
  return 'neutral';
}

export async function GET() {
  // ── 1. BTC price from Binance ────────────────────────────────────────────
  let btcPrice = 0;
  let btcChange24h = 0;

  try {
    const res = await fetch(`${BINANCE_WS}/api/v3/ticker/24hr?symbol=BTCUSDT`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = (await res.json()) as { lastPrice: string; priceChangePercent: string };
      btcPrice = parseFloat(json.lastPrice);
      btcChange24h = parseFloat(json.priceChangePercent);
    }
  } catch { /* continue */ }

  // ── 2. Technical indicators from our indicators route ───────────────────
  let rsi = 50;
  let macdSignal: SentimentType = 'neutral';
  let trendSignal: SentimentType = 'neutral';

  try {
    const res = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/indicators?coin_id=bitcoin&days=30`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = (await res.json()) as { data: { rsi: number; macd: { histogram: number } } };
      const ind = json.data;
      rsi = ind.rsi ?? 50;
      macdSignal = ind.macd?.histogram > 0.001 ? 'positive' : ind.macd?.histogram < -0.001 ? 'negative' : 'neutral';

      // Derive trend from RSI extremes
      if (rsi < 40 || rsi > 60) trendSignal = rsi < 40 ? 'positive' : 'negative';
    }
  } catch { /* continue */ }

  // ── 3. Fear & Greed from alternative.me ─────────────────────────────────
  let fgValue = 50;
  let fgClassification = 'Neutral';

  try {
    const res = await fetch(`${FG_BASE}/?limit=1`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = (await res.json()) as { data: Array<{ value: string; value_classification: string }> };
      fgValue = parseInt(json.data[0]?.value ?? '50', 10);
      fgClassification = json.data[0]?.value_classification ?? 'Neutral';
    }
  } catch { /* continue */ }

  // ── 4. News sentiment from our news route ───────────────────────────────
  let newsSignal: NewsSignal = 'neutral';
  let newsCount = 0;

  try {
    const res = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'}/api/news`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const json = (await res.json()) as { data: Array<{ title: string }> };
      const titles = json.data?.slice(0, 20).map((n: { title: string }) => n.title) ?? [];
      const sentiments = titles.map(inferSentiment);
      const positive = sentiments.filter(s => s === 'positive').length;
      const negative = sentiments.filter(s => s === 'negative').length;
      newsCount = titles.length;
      if (positive > negative + 2) newsSignal = 'bullish';
      else if (negative > positive + 2) newsSignal = 'bearish';
      else newsSignal = 'neutral';
    }
  } catch { /* continue */ }

  // ── 5. Calculate conviction score ────────────────────────────────────────
  const components: ComponentSignal[] = [];

  // Technical (40%): RSI + MACD + trend
  let techScore = 50;
  if (rsi < 30) techScore += 20;
  else if (rsi > 70) techScore -= 20;
  else if (rsi < 40) techScore += 10;
  else if (rsi > 60) techScore -= 10;
  if (macdSignal === 'positive') techScore += 10;
  else if (macdSignal === 'negative') techScore -= 10;
  if (trendSignal === 'positive') techScore += 10;
  else if (trendSignal === 'negative') techScore -= 10;
  techScore = Math.max(0, Math.min(100, techScore));
  components.push({ name: 'Technical', score: techScore, weight: 0.40, value: rsi, status: techScore > 60 ? 'negative' : techScore < 40 ? 'positive' : 'neutral' });

  // Fear & Greed (30%): inverted — low F&G means bullish opportunity
  const fgScore = 100 - fgValue;
  components.push({
    name: 'Fear & Greed',
    score: Math.round(fgScore),
    weight: 0.30,
    value: fgValue,
    status: fgValue < 30 ? 'positive' : fgValue > 70 ? 'negative' : 'neutral',
  });

  // News (20%): sentiment from recent headlines
  let newsScore = 50;
  if (newsSignal === 'bullish') newsScore += 30;
  else if (newsSignal === 'bearish') newsScore -= 30;
  else newsScore += 10; // neutral slightly positive bias for crypto
  newsScore = Math.max(0, Math.min(100, newsScore));
  components.push({ name: 'News Sentiment', score: newsScore, weight: 0.20, value: newsCount, status: newsSignal === 'bullish' ? 'positive' : newsSignal === 'bearish' ? 'negative' : 'neutral' });

  // Momentum (10%): 24h price change
  let momentumScore = 50;
  if (btcChange24h > 5) momentumScore += 25;
  else if (btcChange24h > 2) momentumScore += 15;
  else if (btcChange24h > 0) momentumScore += 5;
  else if (btcChange24h < -5) momentumScore -= 25;
  else if (btcChange24h < -2) momentumScore -= 15;
  else momentumScore -= 5;
  momentumScore = Math.max(0, Math.min(100, momentumScore));
  components.push({ name: 'Momentum', score: momentumScore, weight: 0.10, value: btcChange24h, status: btcChange24h > 2 ? 'positive' : btcChange24h < -2 ? 'negative' : 'neutral' });

  // Weighted conviction score
  const convictionScore = Math.round(
    components.reduce((sum, c) => sum + c.score * c.weight, 0)
  );

  // Confidence based on data availability
  const availableSources = (btcPrice > 0 ? 1 : 0) +
    (fgValue !== 50 ? 1 : 0) +
    (newsCount > 0 ? 1 : 0) +
    (rsi !== 50 ? 1 : 0);
  const confidence = Math.round((availableSources / 4) * 100);

  // Conviction level
  let convictionLevel: ConvictionLevel;
  let convictionLabel: string;
  let reasoning: string;

  if (convictionScore >= 75) {
    convictionLevel = 'high_bullish';
    convictionLabel = 'High Conviction Buy';
    reasoning = 'Multiple bullish signals converging: technical strength, fear-driven opportunity, positive news flow, and strong momentum';
  } else if (convictionScore >= 60) {
    convictionLevel = 'bullish';
    convictionLabel = 'Bullish';
    reasoning = 'Bullish bias from technicals and sentiment indicators';
  } else if (convictionScore <= 25) {
    convictionLevel = 'high_bearish';
    convictionLabel = 'High Conviction Sell';
    reasoning = 'Multiple bearish signals converging: overbought technicals, greed extremes, negative news flow, and negative momentum';
  } else if (convictionScore <= 40) {
    convictionLevel = 'bearish';
    convictionLabel = 'Bearish';
    reasoning = 'Bearish bias from technicals and sentiment indicators';
  } else {
    convictionLevel = 'neutral';
    convictionLabel = 'Neutral';
    reasoning = 'Mixed signals — no strong directional conviction';
  }

  // Market sentiment mapping
  let marketSentiment: MarketSentiment;
  if (fgValue <= 20) marketSentiment = 'extreme_fear';
  else if (fgValue <= 40) marketSentiment = 'fear';
  else if (fgValue <= 60) marketSentiment = 'neutral';
  else if (fgValue <= 80) marketSentiment = 'greed';
  else marketSentiment = 'extreme_greed';

  const response: AlphaSignalData = {
    convictionScore,
    convictionLevel,
    convictionLabel,
    confidence,
    reasoning,
    components,
    marketSentiment,
    btcPrice: Math.round(btcPrice * 100) / 100,
    btcChange24h: Math.round(btcChange24h * 100) / 100,
    newsSignal,
    newsCount,
    timestamp: Date.now(),
  };

  return NextResponse.json({ data: response });
}
