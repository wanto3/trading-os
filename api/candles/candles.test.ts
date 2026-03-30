import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cache module
vi.mock('../cache.js', () => ({
  cacheGet: vi.fn(() => null),
  cacheSet: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);
vi.stubGlobal('AbortSignal', { timeout: (ms: number) => ({ signal: { aborted: false }, timeout: ms }) });

// Mock Vercel types
const mockJson = vi.fn();
const mockSetHeader = vi.fn();
const mockStatus = vi.fn().mockReturnThis();

const mockRes = {
  json: mockJson,
  setHeader: mockSetHeader,
  status: mockStatus,
  end: vi.fn(),
} as unknown as { json: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

// Vercel dynamic routes inject path params into query
// e.g. /api/candles/BTCUSDT → query.symbol = 'BTCUSDT'
function makeCandleReq(params: Record<string, string | string[] | undefined> = {}): unknown {
  return {
    method: 'GET',
    query: { symbol: 'BTCUSDT', ...params },
  };
}

// Test the candles handler logic by importing from the route file
// The route file exports the handler as default
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline the handler test — import from api/candles/[symbol].js (dynamic route)
// We test by importing the module and calling its default export
describe('GET /api/candles/[symbol] — Binance candle data', () => {
  let handler: (req: VercelRequest, res: VercelResponse) => Promise<void>;

  beforeAll(async () => {
    // Dynamic import of the dynamic route handler
    // Vite will resolve this based on the actual file system
    try {
      const mod = await import('./[symbol].js');
      handler = mod.default;
    } catch {
      // File doesn't exist yet — tests will fail at describe level
      // We set a placeholder so individual tests can show "not implemented"
      handler = async (_req: VercelRequest, _res: VercelResponse) => {
        throw new Error('api/candles/[symbol].ts not implemented');
      };
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and transforms Binance klines for the given symbol', async () => {
    const now = Date.now();
    const binanceData = [
      [now, '67000', '67200', '66800', '67100', '500', now + 60000, '33500000'],
      [now + 60000, '67100', '67300', '67000', '67200', '600', now + 120000, '40320000'],
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(binanceData),
    });

    await handler(makeCandleReq({ interval: '1h', limit: '24' }) as VercelRequest, mockRes as VercelResponse);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('BTCUSDT'),
      expect.any(Object)
    );
    const response = mockJson.mock.calls[0][0];
    expect(response.data).toBeInstanceOf(Array);
    expect(response.data.length).toBeGreaterThan(0);
    expect(response.data[0]).toMatchObject({
      open: expect.any(Number),
      high: expect.any(Number),
      low: expect.any(Number),
      close: expect.any(Number),
      openTime: expect.any(Number),
    });
  });

  it('returns candles with openTime as Unix milliseconds (not seconds)', async () => {
    const now = Date.now();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([[now, '100', '110', '95', '105', '50', now + 60000, '5000']]),
    });

    await handler(makeCandleReq({ interval: '1h', limit: '10' }) as VercelRequest, mockRes as VercelResponse);

    const response = mockJson.mock.calls[0][0];
    expect(response.data[0].openTime).toBe(now);
    expect(typeof response.data[0].openTime).toBe('number');
  });

  it('returns 400 when symbol is missing', async () => {
    // Pass empty query (no symbol) to simulate missing path param
    await handler({ method: 'GET', query: {} } as unknown as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.stringContaining('symbol'),
    }));
  });

  it('uses default interval=1d and limit=100', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    await handler(makeCandleReq() as VercelRequest, mockRes as VercelResponse);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('interval=1d');
    expect(calledUrl).toContain('limit=100');
  });

  it('clamps limit to max 500', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    await handler(makeCandleReq({ limit: '9999' }) as VercelRequest, mockRes as VercelResponse);

    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('limit=500');
  });

  it('sets CORS and cache headers', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

    await handler(makeCandleReq({ interval: '4h', limit: '50' }) as VercelRequest, mockRes as VercelResponse);

    expect(mockSetHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(mockSetHeader).toHaveBeenCalledWith('Cache-Control', expect.stringContaining('s-maxage'));
  });

  it('returns 502 on upstream API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });

    await handler(makeCandleReq({ interval: '1d', limit: '100' }) as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(502);
  });

  it('returns 500 on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('DNS failure'));

    await handler(makeCandleReq({ interval: '1d', limit: '100' }) as VercelRequest, mockRes as VercelResponse);

    expect(mockRes.status).toHaveBeenCalledWith(500);
  });
});
