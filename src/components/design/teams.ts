export type TeamColors = { name: string; color: string; accent: string };

// Name-substring → colors. UCI-style. The match is case-insensitive against
// `riders.team`, longest-match-wins. Teams not here fall back to a neutral.
const ENTRIES: Array<[RegExp, TeamColors]> = [
  [/uae/i,                        { name: 'UAE Team Emirates',     color: '#000000', accent: '#d52b1e' }],
  [/jumbo|visma/i,                { name: 'Jumbo-Visma',           color: '#fff100', accent: '#000000' }],
  [/ineos/i,                      { name: 'Ineos Grenadiers',      color: '#0a2240', accent: '#e20613' }],
  [/soudal|quick.?step/i,         { name: 'Soudal Quick-Step',     color: '#002e5f', accent: '#60ace5' }],
  [/lidl|trek/i,                  { name: 'Lidl-Trek',             color: '#e31b23', accent: '#ffffff' }],
  [/movistar/i,                   { name: 'Movistar Team',         color: '#005baa', accent: '#9cc84b' }],
  [/bora|red.?bull/i,             { name: 'Bora Hansgrohe',        color: '#1f2937', accent: '#b91c1c' }],
  [/dsm/i,                        { name: 'Team DSM',              color: '#0c1d2b', accent: '#ff5a00' }],
  [/ef\b|education/i,             { name: 'EF Education',          color: '#ff3d7f', accent: '#202a44' }],
  [/astana/i,                     { name: 'Astana Qazaqstan',      color: '#00a0e6', accent: '#f7e017' }],
  [/israel/i,                     { name: 'Israel-Premier Tech',   color: '#1a3a6d', accent: '#c62128' }],
  [/cofidis/i,                    { name: 'Cofidis',               color: '#d31145', accent: '#ffffff' }],
];

const FALLBACK: TeamColors = { name: 'Independent', color: '#3a3f47', accent: '#9aa0a8' };

export function resolveTeam(text: string | null | undefined): TeamColors {
  if (!text) return FALLBACK;
  for (const [pattern, colors] of ENTRIES) if (pattern.test(text)) return { ...colors, name: text };
  return { ...FALLBACK, name: text };
}
