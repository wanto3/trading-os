import { NextResponse } from "next/server";
import { fetchAllCryptoData } from "@/lib/binance";
import {
  calculateRSI,
  calculateMACD,
  calculateBollinger,
  calculateVolumeProfile,
  calculateVWAP,
  translateFearGreed,
  translateBTCDominance,
} from "@/lib/indicators";
import type { CryptoIndicators } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cryptoData = await fetchAllCryptoData();
    const { prices, fearGreed, btcDominance, klines } = cryptoData;

    const indicators: CryptoIndicators[] = prices.map((price) => {
      const sym = price.symbol;
      const coinKlines = klines[sym as keyof typeof klines] ?? [];
      const closes = coinKlines.map((k) => k.close);

      const rsi = calculateRSI(closes);
      const macd = calculateMACD(closes);
      const bollinger = calculateBollinger(closes);
      const volumeProfile = calculateVolumeProfile(coinKlines);
      const vwap = calculateVWAP(coinKlines);

      // SMA from available OHLC data (7 days of daily candles from CoinGecko)
      const smaValue = closes.length >= 7
        ? closes.slice(-7).reduce((a, b) => a + b, 0) / Math.min(closes.length, 7)
        : 0;
      const aboveSMA = price.price > smaValue && smaValue > 0;

      const fgSignal =
        fearGreed && sym === "BTC"
          ? translateFearGreed(fearGreed)
          : null;
      const btcDomSignal =
        sym === "BTC"
          ? translateBTCDominance(btcDominance)
          : null;

      return {
        symbol: sym,
        price,
        rsi,
        macd,
        bollinger,
        volumeProfile,
        vwap,
        sma200: {
          value: smaValue,
          above: aboveSMA,
          signal: aboveSMA
            ? {
                name: "SMA 7d",
                value: `$${smaValue.toFixed(2)}`,
                plainEnglish: "Above recent support",
                action: "Short-term bullish",
                level: "bullish" as const,
                emoji: "🟢",
              }
            : smaValue > 0
            ? {
                name: "SMA 7d",
                value: `$${smaValue.toFixed(2)}`,
                plainEnglish: "Below recent support",
                action: "Short-term bearish",
                level: "bearish" as const,
                emoji: "🔴",
              }
            : {
                name: "SMA 7d",
                value: "N/A",
                plainEnglish: "Collecting price history",
                action: "Wait for data",
                level: "neutral" as const,
                emoji: "⚪",
              },
        },
        fearGreed: fearGreed ?? {
          value: 50,
          classification: "Neutral",
          lastUpdated: new Date().toISOString(),
        },
        btcDominance: {
          value: btcDominance,
          lastUpdated: new Date().toISOString(),
        },
        lastUpdated: new Date().toISOString(),
      } satisfies CryptoIndicators;
    });

    return NextResponse.json({
      indicators,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Crypto API route error:", err);
    return NextResponse.json(
      { error: "Failed to fetch crypto data", indicators: [] },
      { status: 500 }
    );
  }
}
