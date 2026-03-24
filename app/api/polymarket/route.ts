import { NextResponse } from "next/server";
import { fetchPolymarketMarkets } from "@/lib/polymarket";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const markets = await fetchPolymarketMarkets();
    return NextResponse.json({
      markets,
      trending: markets.filter((m) => m.volumeNum > 100000).slice(0, 20),
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Polymarket API route error:", err);
    return NextResponse.json(
      { error: "Failed to fetch Polymarket data", markets: [] },
      { status: 500 }
    );
  }
}
