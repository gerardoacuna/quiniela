import * as cheerio from 'cheerio';
import type { PcsStartlistEntry } from './types';

export function parseStartlist(html: string): PcsStartlistEntry[] {
  const $ = cheerio.load(html);

  const riders: PcsStartlistEntry[] = [];

  // PCS startlist structure: ul.startlist_v4 > li (one per team)
  // Each team li contains:
  //   - a.team (href to team page)
  //   - ul > li (one per rider) containing a rider-link and span.bib
  // PCS started serving relative hrefs ("rider/kaden-groves") in late April 2026;
  // older snapshots used absolute ("https://www.procyclingstats.com/rider/..."). Both must work.
  $('ul.startlist_v4 > li').each((_, teamLi) => {
    const $teamLi = $(teamLi);

    const teamAnchor = $teamLi.find('a.team').first();
    const team_name = teamAnchor.text().trim().replace(/\s*\(.*?\)\s*$/, '').trim();

    $teamLi.find('ul > li').each((_, riderLi) => {
      const $riderLi = $(riderLi);

      const riderAnchor = $riderLi.find('a[href^="rider/"], a[href*="/rider/"]').first();
      if (riderAnchor.length === 0) return;

      const href = riderAnchor.attr('href') ?? '';
      const riderMatch = href.match(/(?:^|\/)rider\/([^/]+)/);
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
