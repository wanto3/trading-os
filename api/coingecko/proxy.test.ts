import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cache module (in parent api/ directory)
vi.mock('../cache.js', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('AbortSignal', { timeout: (ms: number) => ({ signal: { aborted: false }, timeout: ms }) });

// Mock Vercel Request/Response
const mockJson = vi.fn();
const mockSetHeader = vi.fn();
const mockStatus = vi.fn().mockReturnThis();

const mockRes = {
  json: mockJson,
  setHeader: mockSetHeader,
  status: mockStatus,
  end: vi.fn(),
} as unknown as { json: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

function makeReq(query: Record<string, string | string[] | undefined> = {}): unknown {
  return {
    method: 'GET',
    query,
  };
}

describe('GET /api/coingecko/market-coins', async () => {
  // Must import after mocks are set up
  const handler = (await import('./market-coins.js')).default;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns market data for coins from CoinGecko', async () => {
    const mockData = [
      { id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: 'https://example.com/btc.png', current_price: 67000, market_cap: 1300000000000, market_cap_rank: 1, price_change_percentage_24h: 2.5, total_volume: 50000000000, sparkline_in_7d: { price: [65000, 66000, 67000] } },
      { id: 'ethereum', symbol: 'eth', name: 'Ethereum', image: 'https://example.com/eth.png', current_price: 3500, market_cap: 420000000000, market_cap_rank: 2, price_change_percentage_24h: -1.2, total_volume: 20000000000 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await handler(makeReq({ page: '1', per_page: '2' }) as never, mockRes as never);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.arrayContaining([
        expect.objectContaining({ id: 'bitcoin', current_price: 67000 }),
      ]),
    }));
  });

  it('returns 502 on CoinGecko API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    await handler(makeReq() as never, mockRes as never);

    expect(mockRes.status).toHaveBeenCalledWith(502);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'CoinGecko API error' }));
  });

  it('returns 500 on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await handler(makeReq() as never, mockRes as never);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });

  it('sets CORS and cache headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await handler(makeReq() as never, mockRes as never);

    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'));
  });

  it('returns cached data when available', async () => {
    const cachedData = [{ id: 'bitcoin', symbol: 'btc', name: 'Bitcoin', image: '', current_price: 67000, market_cap: 0, market_cap_rank: 1, price_change_percentage_24h: 0, total_volume: 0 }];
    const { cacheGet } = await import('../cache.js');
    (cacheGet as ReturnType<typeof vi.fn>).mockReturnValueOnce(cachedData);

    await handler(makeReq() as never, mockRes as never);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      data: cachedData,
      _fromCache: true,
    }));
  });
});

describe('GET /api/coingecko/search', async () => {
  const handler = (await import('./search.js')).default;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns search results from CoinGecko', async () => {
    const mockData = {
      coins: [
        { id: 'bitcoin', name: 'Bitcoin', symbol: 'btc', thumb: 'https://example.com/btc.jpg', market_cap_rank: 1 },
      ],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await handler(makeReq({ q: 'bitcoin' }) as never, mockRes as never);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      data: mockData,
    }));
  });

  it('returns empty results for empty query', async () => {
    await handler(makeReq({ q: '' }) as never, mockRes as never);

    expect(mockRes.json).toHaveBeenCalledWith({ data: { coins: [] } });
  });

  it('calls CoinGecko search with encoded query', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ coins: [] }) });

    await handler(makeReq({ q: 'bit coin' }) as never, mockRes as never);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('bit%20coin'),
      expect.any(Object)
    );
  });
});

describe('GET /api/coingecko/market-chart', async () => {
  const handler = (await import('./market-chart.js')).default;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns market chart data from CoinGecko', async () => {
    const mockData = {
      prices: [[Date.now(), 67000], [Date.now() + 86400000, 68000]],
      market_caps: [[Date.now(), 1300000000000]],
      total_volumes: [[Date.now(), 50000000000]],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await handler(makeReq({ coin_id: 'bitcoin', days: '7' }) as never, mockRes as never);

    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      data: mockData,
    }));
  });

  it('returns 400 when coin_id is missing', async () => {
    await handler(makeReq() as never, mockRes as never);

    expect(mockRes.json).toHaveBeenCalledWith({ error: 'coin_id is required' });
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });

  it('clamps days to valid range', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ prices: [], market_caps: [], total_volumes: [] }) });

    await handler(makeReq({ coin_id: 'bitcoin', days: '9999' }) as never, mockRes as never);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('days=730'),
      expect.any(Object)
    );
  });
});
