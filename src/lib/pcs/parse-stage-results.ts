import * as cheerio from 'cheerio';
import type { PcsStageResultEntry } from './types';

export function parseStageResults(html: string): PcsStageResultEntry[] {
  const $ = cheerio.load(html);

  const table = $('table.results').first();
  if (table.length === 0) {
    throw new Error('No results table found');
  }

  const entries: PcsStageResultEntry[] = [];

  table.find('tbody > tr').each((_, tr) => {
    if (entries.length >= 10) return;

    const $tr = $(tr);

    const firstCellText = $tr.find('td').first().text().trim();
    const position = parseInt(firstCellText, 10);
    if (isNaN(position) || position > 10) return;

    const riderAnchor = $tr.find('td.ridername a[href^="rider/"]');
    if (riderAnchor.length === 0) return;

    const riderHref = riderAnchor.attr('href') ?? '';
    // Extract slug: "rider/mads-pedersen" → "mads-pedersen"
    // Also handles "rider/mads-pedersen/2024" → "mads-pedersen"
    const rider_slug = riderHref.replace(/^rider\//, '').split('/')[0];

    const rider_name = riderAnchor.text().trim();

    const teamAnchor = $tr.find('td.cu600 a[href^="team/"]').first();
    const team_name = teamAnchor.text().trim();

    const bibCell = $tr.find('td.bibs');
    const bibText = bibCell.text().trim();
    const bib = bibText ? parseInt(bibText, 10) : null;

    const timeCell = $tr.find('td.time.ar');
    const timeText = timeCell.find('font').first().text().trim();
    const time = timeText && timeText !== ',,' ? timeText : null;

    entries.push({ position, rider_name, rider_slug, team_name, bib: isNaN(bib as number) ? null : bib, time });
  });

  if (entries.length === 0) {
    throw new Error('No rider rows parsed');
  }

  return entries;
}
