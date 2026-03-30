import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Watchlist } from './Watchlist';
import { CoinProvider } from '../context/CoinContext';
import type { CoinMarket } from '../lib/coingecko';

const createMockCoin = (overrides: Partial<CoinMarket> = {}): CoinMarket => ({
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  image: 'https://example.com/btc.png',
  current_price: 67500,
  market_cap: 1300000000000,
  market_cap_rank: 1,
  price_change_percentage_24h: 2.5,
  sparkline_in_7d: { price: [65000, 66000, 67000, 68000, 67500] },
  total_volume: 30000000000,
  ...overrides,
});

const renderWatchlist = (coins: CoinMarket[], favorites: string[] = []) => {
  return render(
    <CoinProvider>
      <Watchlist
        coins={coins}
        favorites={favorites}
        onToggleFavorite={vi.fn()}
        onSetAlert={vi.fn()}
      />
    </CoinProvider>
  );
};

// lucide-react icons (TrendingUp, TrendingDown, Star) also use polyline elements,
// so we scope sparkline polylines by their fixed dimensions 60x24
const sparklineSelector = 'svg[width="60"][height="24"] polyline';

describe('Watchlist sparkline rendering', () => {
  it('renders sparkline polyline when sparkline_in_7d data has sufficient points', () => {
    const coins = [createMockCoin({ id: 'bitcoin', sparkline_in_7d: { price: [64000, 65000, 66000, 67000, 68000] } })];
    renderWatchlist(coins);

    const polylines = document.querySelectorAll(sparklineSelector);
    expect(polylines).toHaveLength(1);
  });

  it('shows placeholder when sparkline_in_7d is undefined', () => {
    const coins = [createMockCoin({ id: 'bitcoin', sparkline_in_7d: undefined })];
    renderWatchlist(coins);

    // Should show a placeholder dash character, not a blank area
    const placeholder = screen.getByText('—');
    expect(placeholder).toBeTruthy();
  });

  it('shows placeholder when sparkline_in_7d.price is empty array', () => {
    const coins = [createMockCoin({ id: 'bitcoin', sparkline_in_7d: { price: [] } })];
    renderWatchlist(coins);

    const placeholder = screen.getByText('—');
    expect(placeholder).toBeTruthy();
  });

  it('shows placeholder when sparkline_in_7d.price has only 1 point', () => {
    const coins = [createMockCoin({ id: 'bitcoin', sparkline_in_7d: { price: [65000] } })];
    renderWatchlist(coins);

    const placeholder = screen.getByText('—');
    expect(placeholder).toBeTruthy();
  });

  it('renders sparkline with positive stroke color when price increased', () => {
    const coins = [createMockCoin({
      id: 'bitcoin',
      price_change_percentage_24h: 5.2,
      sparkline_in_7d: { price: [64000, 65000, 66000, 67000, 68000] },
    })];
    renderWatchlist(coins);

    const polyline = document.querySelector(sparklineSelector);
    expect(polyline).toBeTruthy();
    expect(polyline!.getAttribute('stroke')).toBe('#3fb950');
  });

  it('renders sparkline with negative stroke color when price decreased', () => {
    const coins = [createMockCoin({
      id: 'bitcoin',
      price_change_percentage_24h: -3.1,
      sparkline_in_7d: { price: [68000, 67000, 66000, 65000, 64000] },
    })];
    renderWatchlist(coins);

    const polyline = document.querySelector(sparklineSelector);
    expect(polyline).toBeTruthy();
    expect(polyline!.getAttribute('stroke')).toBe('#f85149');
  });

  it('renders one sparkline per coin with valid data', () => {
    const coins = [
      createMockCoin({ id: 'bitcoin', sparkline_in_7d: { price: [64000, 65000] } }),
      createMockCoin({ id: 'ethereum', sparkline_in_7d: { price: [3200, 3300] } }),
      createMockCoin({ id: 'solana', sparkline_in_7d: { price: [140, 145] } }),
    ];
    renderWatchlist(coins);

    const polylines = document.querySelectorAll(sparklineSelector);
    expect(polylines).toHaveLength(3);
  });

  it('renders mix of sparklines and placeholders for coins with and without data', () => {
    const coins = [
      createMockCoin({ id: 'bitcoin', sparkline_in_7d: { price: [64000, 65000] } }),
      createMockCoin({ id: 'ethereum', sparkline_in_7d: undefined }),
      createMockCoin({ id: 'solana', sparkline_in_7d: { price: [140, 145] } }),
    ];
    renderWatchlist(coins);

    const polylines = document.querySelectorAll(sparklineSelector);
    expect(polylines).toHaveLength(2);

    const placeholders = screen.getAllByText('—');
    expect(placeholders).toHaveLength(1);
  });
});

