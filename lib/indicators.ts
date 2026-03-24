// ============================================================
// Technical Indicator Calculations + Plain English Translation
// ============================================================

import type {
  OHLCV,
  CryptoPrice,
  FearGreedData,
  FundingRate,
  OpenInterest,
  RSIData,
  MACDData,
  BollingerData,
  VolumeProfile,
  VWAPData,
  SMAMovingAverage,
  SignalLevel,
  IndicatorSignal,
} from "./types";

// ============================================================
// Helpers
// ============================================================

function makeSignal(
  name: string,
  value: string | number,
  plainEnglish: string,
  action: string,
  level: SignalLevel,
  emoji: string
): IndicatorSignal {
  return { name, value, plainEnglish, action, level, emoji };
}

// unused
// unused
function _unused_signalLevel(level: SignalLevel): string {
  const icons: Record<SignalLevel, string> = {
    bullish: "🟢",
    bearish: "🔴",
    neutral: "🟡",
    watch: "⚪",
  };
  return icons[level];
}

// ============================================================
// RSI — Relative Strength Index
// ============================================================

export function calculateRSI(closes: number[], period = 14): RSIData {
  if (closes.length < period + 1) {
    return {
      value: 50,
      signal: makeSignal("RSI (14)", "N/A", "Not enough data", "Wait for more data", "neutral", "⚪"),
    };
  }

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const recentChanges = changes.slice(-period);
  let avgGain = 0;
  let avgLoss = 0;
  for (const c of recentChanges) {
    if (c > 0) avgGain += c;
    else avgLoss += Math.abs(c);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  let plain = "";
  let action = "";
  let level: SignalLevel = "neutral";
  let emoji = "⚪";

  if (rsi >= 70) {
    plain = "Overbought — buyers are exhausted";
    action = "Consider taking profits or preparing for a pullback";
    level = "bearish";
    emoji = "🔥";
  } else if (rsi >= 60) {
    plain = "Getting hot — bullish but stretched";
    action = "Still room to run but watch for reversal signs";
    level = "watch";
    emoji = "🌡️";
  } else if (rsi <= 30) {
    plain = "Oversold — sellers are exhausted";
    action = "Potential bounce candidate, look for support";
    level = "bullish";
    emoji = "🛒";
  } else if (rsi <= 40) {
    plain = "Cooling down — bearish but not extreme";
    action = "Caution warranted, but not oversold yet";
    level = "watch";
    emoji = "❄️";
  } else {
    plain = "Healthy — neither overbought nor oversold";
    action = "Neutral zone, follow the trend";
    level = "neutral";
    emoji = "✅";
  }

  return {
    value: Math.round(rsi),
    signal: makeSignal(`RSI (${period})`, Math.round(rsi), plain, action, level, emoji),
  };
}

// ============================================================
// MACD — Moving Average Convergence Divergence
// ============================================================

export function calculateMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signal = 9
): MACDData {
  if (closes.length < slow + signal) {
    return {
      macdLine: 0,
      signalLine: 0,
      histogram: 0,
      crossover: "none",
      signal: makeSignal("MACD", "N/A", "Not enough data", "Wait for more data", "neutral", "⚪"),
    };
  }

  function ema(data: number[], period: number): number {
    const k = 2 / (period + 1);
    let emaVal = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < data.length; i++) {
      emaVal = data[i] * k + emaVal * (1 - k);
    }
    return emaVal;
  }

  const fastEMA = ema(closes, fast);
  const slowEMA = ema(closes, slow);
  const macdLine = fastEMA - slowEMA;

  // MACD line history for signal line
  const macdHistory: number[] = [];
  for (let i = slow; i < closes.length; i++) {
    const f = ema(closes.slice(0, i + 1), fast);
    const s = ema(closes.slice(0, i + 1), slow);
    macdHistory.push(f - s);
  }
  const signalLine = ema(macdHistory, signal);
  const histogram = macdLine - signalLine;

  // Detect crossover
  let crossover: "bullish" | "bearish" | "none" = "none";
  if (macdHistory.length >= 2) {
    const prevMacd = macdHistory[macdHistory.length - 2];
    const prevSig = ema(macdHistory.slice(0, -1), signal);
    if (prevMacd < prevSig && macdLine > signalLine) {
      crossover = "bullish";
    } else if (prevMacd > prevSig && macdLine < signalLine) {
      crossover = "bearish";
    }
  }

  let plain = "";
  let action = "";
  let level: SignalLevel = "neutral";
  let emoji = "➡️";

  if (crossover === "bullish") {
    plain = "Bullish crossover — momentum just flipped up";
    action = "Bullish signal emerging, momentum shifting to buyers";
    level = "bullish";
    emoji = "📈";
  } else if (crossover === "bearish") {
    plain = "Bearish crossover — momentum just flipped down";
    action = "Bearish signal — momentum shifting to sellers";
    level = "bearish";
    emoji = "📉";
  } else if (histogram > 0 && histogram > Math.abs(macdLine) * 0.1) {
    plain = "Bull momentum — buyers in control";
    action = "Bullish momentum intact, stay long";
    level = "bullish";
    emoji = "🟢";
  } else if (histogram < 0 && Math.abs(histogram) > Math.abs(macdLine) * 0.1) {
    plain = "Bear momentum — sellers in control";
    action = "Bearish momentum, stay cautious or short";
    level = "bearish";
    emoji = "🔴";
  } else {
    plain = "Momentum weakening — consolidation likely";
    action = "Hold, don't chase. Wait for clarity";
    level = "neutral";
    emoji = "➡️";
  }

  return {
    macdLine,
    signalLine,
    histogram,
    crossover,
    signal: makeSignal("MACD", Math.round(macdLine * 100) / 100, plain, action, level, emoji),
  };
}

// ============================================================
// Bollinger Bands
// ============================================================

export function calculateBollinger(
  closes: number[],
  period = 20,
  stdDev = 2
): BollingerData {
  if (closes.length < period) {
    return {
      upper: 0,
      middle: 0,
      lower: 0,
      position: "normal",
      bandwidth: 0,
      percentB: 0.5,
      signal: makeSignal("BB (20,2)", "N/A", "Not enough data", "Wait for more data", "neutral", "⚪"),
    };
  }

  const recent = closes.slice(-period);
  const sma = recent.reduce((a, b) => a + b, 0) / period;
  const variance = recent.reduce((sum, v) => sum + Math.pow(v - sma, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = sma + stdDev * std;
  const lower = sma - stdDev * std;
  const bandwidth = ((upper - lower) / sma) * 100;

  const latestClose = closes[closes.length - 1];
  const percentB = (latestClose - lower) / (upper - lower);

  // Squeeze detection: compare bandwidth to 6-month average
  // For simplicity: bandwidth < 5% = squeeze
  const squeeze = bandwidth < 5;

  let position: "squeezed" | "extended_up" | "extended_down" | "normal" = "normal";
  let plain = "";
  let action = "";
  let level: SignalLevel = "neutral";
  let emoji = "📊";

  if (squeeze) {
    position = "squeezed";
    plain = "Bollinger squeeze — big move incoming";
    action = "Watch closely! Direction unclear but volatility will likely explode";
    level = "watch";
    emoji = "⚡";
  } else if (percentB > 0.95) {
    position = "extended_up";
    plain = "At upper band — extended, reverting soon";
    action = "Overextended upward, expect mean reversion";
    level = "bearish";
    emoji = "🔴";
  } else if (percentB < 0.05) {
    position = "extended_down";
    plain = "At lower band — deeply discounted";
    action = "At support, potential bounce candidate";
    level = "bullish";
    emoji = "🟢";
  } else {
    position = "normal";
    plain = "Price in normal range within bands";
    action = "Nothing extreme, follow the trend";
    level = "neutral";
    emoji = "✅";
  }

  return {
    upper,
    middle: sma,
    lower,
    position,
    bandwidth,
    percentB,
    signal: makeSignal(
      "BB (20,2)",
      `$${latestClose.toLocaleString()}`,
      plain,
      action,
      level,
      emoji
    ),
  };
}

// ============================================================
// Volume Profile
// ============================================================

export function calculateVolumeProfile(klines: OHLCV[]): VolumeProfile {
  if (klines.length < 2) {
    return {
      upVolume: 0,
      downVolume: 0,
      percentUp: 50,
      trend: "neutral",
      signal: makeSignal("Volume Profile", "N/A", "Not enough data", "Wait for more data", "neutral", "⚪"),
    };
  }

  let upVolume = 0;
  let downVolume = 0;

  for (let i = 1; i < klines.length; i++) {
    const change = klines[i].close - klines[i - 1].close;
    const vol = klines[i].volume;
    if (change > 0) upVolume += vol;
    else downVolume += vol;
  }

  const total = upVolume + downVolume;
  const percentUp = total > 0 ? (upVolume / total) * 100 : 50;

  let trend: "accumulating" | "distributing" | "neutral" = "neutral";
  let plain = "";
  let action = "";
  let level: SignalLevel = "neutral";
  let emoji = "➡️";

  if (percentUp > 60) {
    trend = "accumulating";
    plain = "Accumulating — buyers stepping in on up-days";
    action = "Bullish volume pattern, buyers are aggressive";
    level = "bullish";
    emoji = "🟢";
  } else if (percentUp < 40) {
    trend = "distributing";
    plain = "Distributing — sellers stepping in on down-days";
    action = "Bearish volume pattern, sellers are aggressive";
    level = "bearish";
    emoji = "🔴";
  } else {
    plain = "Volume balanced — no strong directional conviction";
    action = "Neutral volume, await directional volume";
    level = "neutral";
    emoji = "⚪";
  }

  return {
    upVolume,
    downVolume,
    percentUp: Math.round(percentUp),
    trend,
    signal: makeSignal("Vol Profile", `${Math.round(percentUp)}% up`, plain, action, level, emoji),
  };
}

// ============================================================
// VWAP
// ============================================================

export function calculateVWAP(klines: OHLCV[]): VWAPData {
  if (klines.length === 0) {
    return {
      value: 0,
      above: false,
      signal: makeSignal("VWAP", "N/A", "Not enough data", "Wait for more data", "neutral", "⚪"),
    };
  }

  let cumVP = 0;
  let cumVol = 0;
  for (const k of klines) {
    const typicalPrice = (k.high + k.low + k.close) / 3;
    cumVP += typicalPrice * k.volume;
    cumVol += k.volume;
  }
  const vwap = cumVol > 0 ? cumVP / cumVol : klines[klines.length - 1].close;
  const latestClose = klines[klines.length - 1].close;
  const above = latestClose > vwap;

  const plain = above
    ? "Trading above today's average price — bullish bias"
    : "Trading below today's average price — bearish bias";
  const action = above ? "Holding above VWAP = bullish day" : "Below VWAP = bearish bias today";
  const level: SignalLevel = above ? "bullish" : "bearish";
  const emoji = above ? "🟢" : "🔴";

  return {
    value: vwap,
    above,
    signal: makeSignal("VWAP", `$${vwap.toFixed(2)}`, plain, action, level, emoji),
  };
}

// ============================================================
// 200-Day SMA
// ============================================================

export function calculateSMA200(prices: CryptoPrice, dailyCloses: number[]): SMAMovingAverage {
  if (dailyCloses.length < 200) {
    return {
      value: 0,
      above: false,
      signal: makeSignal("SMA 200", "N/A", "Not enough daily data", "Need 200 days of data", "neutral", "⚪"),
    };
  }

  const last200 = dailyCloses.slice(-200);
  const sma200 = last200.reduce((a, b) => a + b, 0) / 200;
  const currentPrice = prices.price;
  const above = currentPrice > sma200;

  const percentAbove = ((currentPrice - sma200) / sma200) * 100;

  const plain = above
    ? `Above 200-day MA — structural uptrend (+${percentAbove.toFixed(1)}%)`
    : `Below 200-day MA — structural downtrend (${percentAbove.toFixed(1)}%)`;
  const action = above
    ? "In a macro bull trend, don't fight it"
    : "In a macro bear trend, stay cautious";
  const level: SignalLevel = above ? "bullish" : "bearish";
  const emoji = above ? "🟢" : "🔴";

  return {
    value: sma200,
    above,
    signal: makeSignal("SMA 200", `$${sma200.toFixed(2)}`, plain, action, level, emoji),
  };
}

// ============================================================
// Funding Rate Translation
// ============================================================

export function translateFundingRate(fr: FundingRate): IndicatorSignal {
  const rate = fr.rate; // percentage per 8h

  if (rate > 0.1) {
    return makeSignal(
      `${fr.symbol} Funding`,
      `+${rate.toFixed(3)}%`,
      "High positive funding — longs paying shorts heavily",
      "High risk of long squeeze. Longs being incentivized = crowded trade",
      "bearish",
      "⚠️"
    );
  } else if (rate > 0.03) {
    return makeSignal(
      `${fr.symbol} Funding`,
      `+${rate.toFixed(3)}%`,
      "Positive funding — slight bullish pressure",
      "Bulls slightly aggressive, funding is normal",
      "neutral",
      "🟡"
    );
  } else if (rate < -0.1) {
    return makeSignal(
      `${fr.symbol} Funding`,
      `${rate.toFixed(3)}%`,
      "Negative funding — shorts paying longs heavily",
      "Short squeeze risk. Shorts crowded = dangerous",
      "bullish",
      "⚠️"
    );
  } else if (rate < -0.03) {
    return makeSignal(
      `${fr.symbol} Funding`,
      `${rate.toFixed(3)}%`,
      "Negative funding — slight bearish pressure",
      "Bears slightly aggressive, funding is normal",
      "neutral",
      "🟡"
    );
  }

  return makeSignal(
    `${fr.symbol} Funding`,
    `${rate.toFixed(3)}%`,
    "Funding rate neutral",
    "No unusual pressure from funding",
    "neutral",
    "✅"
  );
}

// ============================================================
// Open Interest Translation
// ============================================================

export function translateOpenInterest(oi: OpenInterest): IndicatorSignal {
  const change = oi.change24h;

  if (change > 10) {
    return makeSignal(
      `${oi.symbol} OI`,
      "Rising ↑",
      "Open interest surging — capital flowing in, war brewing",
      "Big move incoming, either long squeeze or short squeeze. Watch funding rate",
      "watch",
      "⚡"
    );
  } else if (change < -10) {
    return makeSignal(
      `${oi.symbol} OI`,
      "Falling ↓",
      "Open interest dropping — war ending, positions closing",
      "Volatility likely to decrease, squeeze may be unwinding",
      "neutral",
      "➡️"
    );
  }

  return makeSignal(
    `${oi.symbol} OI`,
    "Stable",
    "Open interest stable",
    "No unusual capital flow, expect range-bound",
    "neutral",
    "➡️"
  );
}

// ============================================================
// Fear & Greed Translation
// ============================================================

export function translateFearGreed(fg: FearGreedData): IndicatorSignal {
  const { value, classification } = fg;

  if (value >= 80) {
    return makeSignal("Fear & Greed", `${value} — Extreme Greed`, "Extreme greed — market is euphoric", "Risk off! Market too bullish. Consider taking profits", "bearish", "😱");
  } else if (value >= 65) {
    return makeSignal("Fear & Greed", `${value} — Greed`, "Greedy — market getting stretched", "Getting greedy, caution warranted", "watch", "😬");
  } else if (value <= 20) {
    return makeSignal("Fear & Greed", `${value} — Extreme Fear`, "Extreme fear — capitulation likely", "Buy the dip zone! Extreme fear often marks bottoms", "bullish", "🛒");
  } else if (value <= 35) {
    return makeSignal("Fear & Greed", `${value} — Fear`, "Fearful — people are scared", "Fear is high, potential opportunity forming", "watch", "😟");
  }

  return makeSignal(
    "Fear & Greed",
    `${value} — ${classification}`,
    "Neutral sentiment",
    "No extreme reading, market in equilibrium",
    "neutral",
    "😐"
  );
}

// ============================================================
// BTC Dominance Translation
// ============================================================

export function translateBTCDominance(dom: number): IndicatorSignal {
  if (dom > 55) {
    return makeSignal("BTC Dominance", `${dom.toFixed(1)}%`, "BTC season — alts suffering", "Money flowing into BTC, altcoins underperforming. Don't chase alts", "bearish", "🟡");
  } else if (dom < 45) {
    return makeSignal("BTC Dominance", `${dom.toFixed(1)}%`, "Altcoin season — alts outperforming", "Alt season! Money rotating into alts. BTC dominance falling", "bullish", "🟢");
  }

  return makeSignal(
    "BTC Dominance",
    `${dom.toFixed(1)}%`,
    "Neutral — BTC and alts balanced",
    "No clear sector rotation, mixed market",
    "neutral",
    "⚪"
  );
}

// ============================================================
// Funding Rate Open Interest combined for crypto
// ============================================================

export function translateFundingAndOI(fr: FundingRate | null, oi: OpenInterest | null): IndicatorSignal[] {
  const signals: IndicatorSignal[] = [];
  if (fr) signals.push(translateFundingRate(fr));
  if (oi) signals.push(translateOpenInterest(oi));
  return signals;
}
