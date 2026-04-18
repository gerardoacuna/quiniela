import * as cheerio from 'cheerio';
import type { PcsClassificationEntry } from './types';

export function parseClassification(html: string): PcsClassificationEntry[] {
  const $ = cheerio.load(html);

  // The page has multiple result tabs (stage, GC, points, etc.).
  // The active tab is the div.resTab that does NOT have the "hide" class.
  // We parse the first table.results inside the active resTab.
  let table = $('div.resTab:not(.hide) table.results').first();

  // Fallback: if no resTab structure found, try the first table.results directly
  if (table.length === 0) {
    table = $('table.results').first();
  }

  if (table.length === 0) {
    throw new Error('No results table found');
  }

  const entries: PcsClassificationEntry[] = [];

  table.find('tbody > tr').each((_, tr) => {
    const $tr = $(tr);

    const firstCellText = $tr.find('td').first().text().trim();
    const position = parseInt(firstCellText, 10);
    if (isNaN(position)) return;

    const riderAnchor = $tr.find('td.ridername a[href^="rider/"]');
    if (riderAnchor.length === 0) return;

    const riderHref = riderAnchor.attr('href') ?? '';
    // Extract slug: "rider/simon-yates" → "simon-yates"
    // Also handles "rider/simon-yates/2024" → "simon-yates"
    const rider_slug = riderHref.replace(/^rider\//, '').split('/')[0];

    const rider_name = riderAnchor.text().trim();

    const teamAnchor = $tr.find('td.cu600 a[href^="team/"]').first();
    const team_name = teamAnchor.text().trim();

    entries.push({ position, rider_name, rider_slug, team_name });
  });

  if (entries.length === 0) {
    throw new Error('No rider rows parsed');
  }

  return entries;
}
