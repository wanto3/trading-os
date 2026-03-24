// ============================================================
// Rule-Based Briefing — no AI, no API key, instant
// Runs entirely client-side
// ============================================================

import type { AIBriefing, BriefingTrade } from "./types";

interface BriefingRequest {
  cryptoIndicators: any[];
  polymarketMarkets: any[];
}

export function generateBriefing(data: BriefingRequest): AIBriefing {
  const { cryptoIndicators, polymarketMarkets } = data;

  const btc = cryptoIndicators?.find((c: any) => c.symbol === "BTC");
  const eth = cryptoIndicators?.find((c: any) => c.symbol === "ETH");
  const sol = cryptoIndicators?.find((c: any) => c.symbol === "SOL");

  // ── CRYPTO ANALYSIS ──────────────────────────────────────
  const cryptoSignals: string[] = [];
  const risks: string[] = [];
  let convictionScore = 0;

  // RSI analysis
  for (const coin of [btc, eth, sol]) {
    if (!coin || !coin.rsi?.value) continue;
    const rsi = coin.rsi.value;
    if (rsi <= 25) {
      cryptoSignals.push(`${coin.symbol} RSI at ${rsi} — deeply oversold, potential bounce`);
      convictionScore += 2;
    } else if (rsi >= 70) {
      cryptoSignals.push(`${coin.symbol} RSI at ${rsi} — overbought, pullback likely`);
      convictionScore -= 1;
      risks.push(`${coin.symbol} overbought — risk of pullback`);
    }
  }

  // MACD analysis
  for (const coin of [btc, eth]) {
    if (!coin?.macd) continue;
    if (coin.macd.crossover === "bullish") {
      cryptoSignals.push(`${coin.symbol} MACD bullish crossover — momentum shifting up`);
      convictionScore += 2;
    }
    if (coin.macd.crossover === "bearish") {
      cryptoSignals.push(`${coin.symbol} MACD bearish crossover — momentum shifting down`);
      convictionScore -= 2;
      risks.push(`${coin.symbol} momentum bearish — stay cautious`);
    }
    if (coin.macd.histogram > 0) {
      convictionScore += 1;
    }
  }

  // Bollinger squeeze
  for (const coin of [btc, eth, sol]) {
    if (!coin?.bollinger) continue;
    if (coin.bollinger.position === "squeezed") {
      cryptoSignals.push(`${coin.symbol} Bollinger squeeze — big move coming, watch closely`);
      risks.push(`${coin.symbol} Bollinger squeeze — volatility explosion imminent, direction uncertain`);
    }
  }

  // Fear & Greed
  if (btc?.fearGreed) {
    const fg = btc.fearGreed.value;
    if (fg <= 20) {
      cryptoSignals.push(`Fear & Greed: ${fg} — Extreme Fear, historically a buying zone`);
      convictionScore += 2;
    } else if (fg >= 80) {
      cryptoSignals.push(`Fear & Greed: ${fg} — Extreme Greed, consider taking profits`);
      convictionScore -= 1;
      risks.push("Extreme greed — market may be topping out");
    }
  }

  // ── SUMMARY ───────────────────────────────────────────────
  let summary = "";
  if (convictionScore >= 3) {
    summary = `Multiple bullish signals across crypto. RSI oversold in ${btc?.rsi?.value <= 30 ? "BTC" : "key assets"} with Fear & Greed at extreme fear (${btc?.fearGreed?.value ?? "?"}). Bulls are building energy.`;
  } else if (convictionScore <= -2) {
    summary = `Bearish signals present. Overbought conditions and MACD crossovers suggest caution. ${risks.length > 0 ? risks[0] : ""}`;
  } else {
    summary = `Mixed signals. Market in a cautious state. Extreme Fear (${btc?.fearGreed?.value ?? "?"}/100) historically precedes rallies, but wait for confirmation.`;
  }

  // ── TOP CONVICTION TRADES ────────────────────────────────
  const trades: BriefingTrade[] = [];

  // Add crypto as "trades"
  for (const coin of [btc, eth, sol]) {
    if (!coin) continue;
    const rsi = coin.rsi.value;
    if (rsi > 0 && rsi <= 35) {
      const conviction = rsi <= 25 ? "high" : "medium";
      trades.push({
        market: `${coin.symbol}/USDT — Oversold bounce`,
        odds: `${coin.symbol} RSI: ${rsi}`,
        conviction,
        reason: `RSI at ${rsi} — sellers exhausted, buyers have opportunity`,
        urgency_hours: 24,
        action: conviction === "high" ? "Consider entering — high conviction bounce setup" : "Watch for entry — RSI oversold",
      });
    } else if (rsi >= 65) {
      trades.push({
        market: `${coin.symbol}/USDT — Overbought caution`,
        odds: `${coin.symbol} RSI: ${rsi}`,
        conviction: rsi >= 75 ? "high" : "medium",
        reason: `RSI at ${rsi} — buyers exhausted, pullback likely`,
        urgency_hours: 24,
        action: "Consider taking profits or waiting for pullback entry",
      });
    }
  }

  // Add Polymarket markets (urgent ones first)
  const urgentPM = [...(polymarketMarkets ?? [])]
    .filter((m: any) => !m.resolved && !m.closed && (m.urgency ?? 999) > 0)
    .sort((a: any, b: any) => (a.urgency ?? 999) - (b.urgency ?? 999))
    .slice(0, 8);

  for (const market of urgentPM) {
    const odds = Math.round(parseFloat(market.outcomePrices?.[0] ?? "0.5") * 100);
    const volume = market.volumeNum ?? 0;
    const urgency = market.urgency ?? 999;
    const question = market.question;

    // Conviction based on odds extremity (near 0% or 100% = higher confidence)
    let pmConviction: "high" | "medium" | "low" = "medium";
    let pmAction = "Watch — odds suggest this is a viable position";
    let pmReason = `${odds}% YES according to the market`;

    if (odds >= 75) {
      pmConviction = odds >= 85 ? "high" : "medium";
      pmReason = `${odds}% YES — strong consensus, but no sure thing`;
      pmAction = odds >= 90 ? "High risk of disappointment — odds already price it in" : "Consensus trade — monitor for reversal";
    } else if (odds <= 25) {
      pmConviction = odds <= 15 ? "high" : "medium";
      pmReason = `${odds}% YES — contrarian opportunity if you have information edge`;
      pmAction = odds <= 10 ? "High risk long shot — only if you know something" : "Contrarian play — risk/reward improving";
    }

    // Volume quality check
    if (volume < 5000) {
      pmConviction = "low";
      pmReason += " (low volume — hard to exit)";
      pmAction = "Skip — insufficient liquidity for reliable odds";
    }

    trades.push({
      market: question.length > 60 ? question.slice(0, 57) + "..." : question,
      odds: `${odds}% YES`,
      conviction: pmConviction,
      reason: pmReason,
      urgency_hours: urgency,
      action: pmAction,
    });
  }

  // Sort by urgency first, then conviction
  const convictionOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  trades.sort((a, b) => {
    const uDiff = (a.urgency_hours ?? 999) - (b.urgency_hours ?? 999);
    if (uDiff !== 0) return uDiff;
    return (convictionOrder[a.conviction] ?? 2) - (convictionOrder[b.conviction] ?? 2);
  });

  return {
    summary,
    topConvictionTrades: trades.slice(0, 6),
    quickSignals: cryptoSignals.slice(0, 5),
    risks: risks.slice(0, 3),
    timestamp: new Date().toISOString(),
  };
}
