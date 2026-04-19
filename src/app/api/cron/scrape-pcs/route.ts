import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron/auth';
import { scrapeAndPersist } from '@/lib/cron/scrape';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const result = await scrapeAndPersist();
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
