# Trading OS — SPEC.md

## 1. Concept & Vision

A **Trading Operating System** — a professional-grade crypto market dashboard that helps traders make informed decisions. Clean, data-dense, zero fluff. Think Bloomberg Terminal aesthetics with modern web sensibilities: dark mode by default, real-time data feel, and clear visual hierarchy that lets numbers speak. The product should feel like a tool built by traders for traders.

## 2. Design Language

- **Aesthetic**: Dark terminal — deep charcoal backgrounds, neon accent data (green for gains, red for losses), monospace numbers, clean sans-serif labels
- **Color Palette**:
  - Background: `#0d1117` (deep dark)
  - Surface: `#161b22` (card/panel background)
  - Border: `#30363d` (subtle borders)
  - Text Primary: `#e6edf3` (white-ish)
  - Text Secondary: `#8b949e` (muted)
  - Accent Green (gain): `#3fb950`
  - Accent Red (loss): `#f85149`
  - Accent Blue (neutral/highlight): `#58a6ff`
  - Accent Yellow (alert): `#d29922`
- **Typography**:
  - Numbers/Data: `JetBrains Mono` (monospace, crisp)
  - Labels/Headings: `Inter` (clean sans-serif)
- **Spatial System**: 4px base unit, 8px gaps, 16px card padding, 24px section spacing
- **Motion**: Minimal — 150ms transitions on hover, subtle pulse on live data updates, smooth scroll

## 3. Layout & Structure

### Page Structure
Single-page dashboard with responsive grid:

```
┌─────────────────────────────────────────────────────┐
│  HEADER: Logo | Market Summary Bar | Time           │
├───────────────┬─────────────────────────────────────┤
│  WATCHLIST    │  MAIN CHART (Candlestick)          │
│  (left rail)  │                                     │
│               │                                     │
│  - Favorites  ├─────────────────────────────────────┤
│  - Search     │  BOTTOM ROW:                        │
│               │  [Market Stats] [Indicators] [News] │
└───────────────┴─────────────────────────────────────┘
```

- **Left Rail (240px)**: Watchlist with mini price, 24h change, sparkline
- **Main Chart (flex)**: Full candlestick chart with timeframe selector (1H, 4H, 1D, 1W)
- **Bottom Row**: Tabbed panel — Market Stats | Technical Indicators | News Feed

### Responsive Strategy
- Desktop (>1024px): Full layout as above
- Tablet (768-1024px): Watchlist collapses to top horizontal scroll
- Mobile (<768px): Single column, tabs for Watchlist/Chart/Stats

## 4. Features & Interactions

### Watchlist
- Default top 20 cryptocurrencies by market cap
- Click to switch main chart to that coin
- Mini sparkline (7d price) per row
- Price, 24h %, 7d %, market cap displayed
- Search bar to add coins to watchlist
- Favorite toggle (star icon) — persisted in localStorage

### Candlestick Chart
- Powered by lightweight-charts (TradingView open-source)
- Timeframes: 1H, 4H, 1D, 1W — clickable tabs
- Hover tooltip: OHLCV data
- Volume bars below price
- Crosshair on hover
- Coin selector synced with watchlist

### Market Stats Panel (Tab)
- Dominance chart (pie): BTC vs ETH vs Other
- Global market cap, 24h volume, BTC dominance
- Fear & Greed index display (placeholder)

### Technical Indicators Panel (Tab)
- RSI (14): gauge or line chart
- MACD: histogram + signal line
- Moving Averages: SMA 20, SMA 50, SMA 200 overlay option
- Toggle each indicator on/off

### News Feed Panel (Tab)
- Recent crypto news titles (from a free news API or static for MVP)
- Source, time ago, click to open
- Basic sentiment indicator (positive/negative/neutral)

### Price Alerts
- "Set Alert" button on any watchlist item
- Alert modal: price threshold (above/below)
- Alerts stored in localStorage
- Visual badge when price crosses threshold (toast notification)

### Search
- Header search bar for finding coins
- Autocomplete dropdown (CoinGecko search API)
- Add to watchlist on select

## 5. Component Inventory

### `<Header>`
- Logo: "TradeOS" in JetBrains Mono, accent blue
- Market summary: BTC price + 24h change, ETH price + 24h change (mini pills)
- Current UTC time (updates every second)
- Search bar (center)

### `<Watchlist>`
- Card with header "Watchlist"
- Scrollable list of `<WatchlistItem>`
- `<WatchlistItem>`: coin icon, name, price, 24h%, sparkline, star toggle

### `<WatchlistItem>`
- States: default, selected (left border accent blue), hover (surface lighten)
- Click: selects coin for main chart

### `<CandlestickChart>`
- Full-width TradingView lightweight-charts
- Timeframe tabs above chart
- Loading skeleton while fetching
- Error state with retry button

### `<StatsPanel>` / `<IndicatorsPanel>` / `<NewsPanel>`
- Tabbed container
- Each panel self-contained

### `<AlertModal>`
- Overlay modal
- Price input + condition selector (above/below)
- Save to localStorage
- List of active alerts below form

### `<Toast>`
- Fixed bottom-right
- Appears when alert triggers
- Auto-dismiss after 5s

## 6. Technical Approach

### Stack
- **Framework**: React 18 + Vite (TypeScript)
- **Styling**: Tailwind CSS
- **Charts**: `lightweight-charts` (TradingView open-source)
- **Icons**: Lucide React
- **Data**: CoinGecko API (free tier, no auth required)
- **State**: React hooks + Context for selected coin
- **Persistence**: localStorage for watchlist + alerts

### Data Sources
- CoinGecko `/coins/markets` — price, market cap, sparklines
- CoinGecko `/coins/{id}/ohlc` — OHLCV candlestick data
- CoinGecko `/search` — coin search
- CoinGecko `/global` — global market data
- CryptoFearFomo API or static placeholder for Fear & Greed

### API Limits
- CoinGecko free tier: ~50 calls/min
- Implement request caching (5-min cache for market data, 1-min for search)
- React Query or manual fetch with SWR pattern

### Project Structure
```
/
├── SPEC.md
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Watchlist.tsx
│   │   ├── WatchlistItem.tsx
│   │   ├── CandlestickChart.tsx
│   │   ├── TabPanel.tsx
│   │   ├── StatsPanel.tsx
│   │   ├── IndicatorsPanel.tsx
│   │   ├── NewsPanel.tsx
│   │   ├── AlertModal.tsx
│   │   ├── Toast.tsx
│   │   └── SearchBar.tsx
│   ├── hooks/
│   │   ├── useCoins.ts
│   │   ├── useOhlc.ts
│   │   ├── useGlobalData.ts
│   │   └── useWatchlist.ts
│   ├── context/
│   │   └── CoinContext.tsx
│   └── lib/
│       └── coingecko.ts
├── public/
│   └── vite.svg
```

### Vercel Deployment
- GitHub repo required
- `vercel.json` with default React/Vite config
- Environment variables if needed (none required for CoinGecko free tier)
- Auto-deploy on push to main

### Vercel Config (`vercel.json`)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```
