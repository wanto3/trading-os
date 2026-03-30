import { NextResponse } from 'next/server';

const FG_BASE = 'https://api.alternative.me/fng';

export async function GET() {
  try {
    const res = await fetch(`${FG_BASE}/?limit=1`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ error: 'Alternative.me API error', status: res.status }, { status: 502 });

    const json = (await res.json()) as {
      data: Array<{ value: string; value_classification: string; timestamp: string }>;
    };
    const item = json.data?.[0];

    if (!item) return NextResponse.json({ error: 'No data returned' }, { status: 502 });

    const response = {
      data: {
        value: parseInt(item.value, 10),
        value_classification: item.value_classification,
        timestamp: item.timestamp,
      },
    };

    return NextResponse.json(response);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch Fear & Greed data' }, { status: 500 });
  }
}
