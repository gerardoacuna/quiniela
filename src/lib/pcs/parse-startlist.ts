import * as cheerio from 'cheerio';
import type { PcsStartlistEntry } from './types';

export function parseStartlist(html: string): PcsStartlistEntry[] {
  const $ = cheerio.load(html);

  const riders: PcsStartlistEntry[] = [];

  // PCS startlist structure: ul.startlist_v4 > li (one per team)
  // Each team li contains:
  //   - a.team (with full URL href like https://...procyclingstats.com/team/slug-YEAR)
  //   - ul > li (one per rider) containing a[href*="/rider/"] and span.bib
  $('ul.startlist_v4 > li').each((_, teamLi) => {
    const $teamLi = $(teamLi);

    const teamAnchor = $teamLi.find('a.team').first();
    const team_name = teamAnchor.text().trim().replace(/\s*\(.*?\)\s*$/, '').trim();

    $teamLi.find('ul > li').each((_, riderLi) => {
      const $riderLi = $(riderLi);

      const riderAnchor = $riderLi.find('a[href*="/rider/"]').first();
      if (riderAnchor.length === 0) return;

      const href = riderAnchor.attr('href') ?? '';
      // href looks like "https://www.procyclingstats.com/rider/primoz-roglic"
      const riderMatch = href.match(/\/rider\/([^/]+)/);
      if (!riderMatch) return;
      const rider_slug = riderMatch[1];

      const rider_name = riderAnchor.text().trim();

      const bibText = $riderLi.find('span.bib').text().trim();
      const bib = bibText ? parseInt(bibText, 10) : null;

      riders.push({
        rider_name,
        rider_slug,
        team_name,
        bib: bib !== null && !isNaN(bib) ? bib : null,
      });
    });
  });

  if (riders.length === 0) {
    throw new Error('No riders found in startlist');
  }

  return riders;
}
