import { getActiveEdition } from '@/lib/queries/stages';
import { getAdminCounts, getCronRuns, listScrapeErrors, listAuditEvents } from '@/lib/queries/admin';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

function relative(iso: string | null): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function AdminDashboard() {
  const edition = await getActiveEdition();
  if (!edition) return <div>No active edition.</div>;

  const [counts, crons, errors, events] = await Promise.all([
    getAdminCounts(edition.id),
    getCronRuns(),
    listScrapeErrors(5),
    listAuditEvents(10),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard — {edition.name}</h1>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Players</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{counts.players}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Counted stages</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{counts.countedStages}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Pending invites</CardTitle></CardHeader>
          <CardContent className="text-3xl font-bold">{counts.pendingInvites}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Cron jobs</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {crons.length === 0 ? (
            <p className="text-muted-foreground">No cron rows found.</p>
          ) : (
            crons.map((c) => (
              <div key={c.job_name} className="flex items-center justify-between">
                <div className="font-mono">{c.job_name}</div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">last ok: {relative(c.last_succeeded_at)}</span>
                  {(c.consecutive_failures ?? 0) > 0 && (
                    <Badge variant="destructive">{c.consecutive_failures} fails</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent scrape errors</CardTitle></CardHeader>
        <CardContent>
          {errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">None in recent history.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {errors.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{relative(e.run_at)}</span>
                  <span className="font-mono text-xs">{e.target}</span>
                  <span className="truncate">{e.error}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent audit events</CardTitle></CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No actions logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{relative(e.created_at)}</span>
                  <span className="font-mono text-xs">{e.action}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
