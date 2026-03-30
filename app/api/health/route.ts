import { NextResponse } from 'next/server';

const startTime = Date.now();

export async function GET() {
  return NextResponse.json({
    data: {
      status: 'ok',
      uptime: Math.round((Date.now() - startTime) / 1000),
      timestamp: Date.now(),
    },
  });
}
