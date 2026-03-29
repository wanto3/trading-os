import type { VercelRequest, VercelResponse } from '@vercel/node';

const startTime = Date.now();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.json({
    data: {
      status: 'ok',
      uptime: Math.round((Date.now() - startTime) / 1000),
      timestamp: Date.now(),
    },
  });
}
