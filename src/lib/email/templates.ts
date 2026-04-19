export function stageDraftReady(stageNumber: number, inspectUrl: string): { subject: string; text: string } {
  return {
    subject: `Stage ${stageNumber} draft results ready for review`,
    text: `Scraped top-10 for Stage ${stageNumber} is waiting for an admin to review and publish.\n\nReview: ${inspectUrl}\n`,
  };
}

export function pickReminder(
  displayName: string,
  stageNumber: number,
  locksAt: Date,
  pickUrl: string,
): { subject: string; text: string } {
  const locksIn = formatRelative(locksAt.getTime() - Date.now());
  return {
    subject: `Pick a rider for Stage ${stageNumber} (locks in ${locksIn})`,
    text: `Hey ${displayName},\n\nStage ${stageNumber} locks ${locksAt.toLocaleString()} (${locksIn} from now) and you haven't picked a rider yet.\n\nPick now: ${pickUrl}\n`,
  };
}

function formatRelative(ms: number): string {
  if (ms <= 0) return 'now';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}
