export interface PcsStageResultEntry {
  position: number;            // 1..10 (we keep the top 10)
  rider_name: string;
  rider_slug: string;          // e.g. 'tadej-pogacar'
  team_name: string;
  bib: number | null;
  time: string | null;         // e.g. '4:23:45' or '+0:12'
}

export interface PcsStartlistEntry {
  rider_name: string;
  rider_slug: string;
  team_name: string;
  bib: number | null;
}

export interface PcsClassificationEntry {
  position: number;
  rider_name: string;
  rider_slug: string;
  team_name: string;
}
