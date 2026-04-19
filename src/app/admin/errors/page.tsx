import { listScrapeErrors, listAuditEvents } from '@/lib/queries/admin';

export default async function ErrorsPage() {
  const [scrapeErrors, auditEvents] = await Promise.all([
    listScrapeErrors(50),
    listAuditEvents(50),
  ]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">Scrape errors</h1>
        {scrapeErrors.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">None.</p>
        ) : (
          <table className="w-full text-xs mt-2 font-mono">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">When</th>
                <th className="p-2 text-left">Target</th>
                <th className="p-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {scrapeErrors.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(e.run_at).toLocaleString()}</td>
                  <td className="p-2">{e.target}</td>
                  <td className="p-2 whitespace-pre-wrap break-all">{e.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h1 className="text-2xl font-bold">Audit log</h1>
        {auditEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">None.</p>
        ) : (
          <table className="w-full text-xs mt-2 font-mono">
            <thead className="bg-muted">
              <tr>
                <th className="p-2 text-left">When</th>
                <th className="p-2 text-left">Action</th>
                <th className="p-2 text-left">Target</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.map((e) => (
                <tr key={e.id} className="border-t align-top">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="p-2">{e.action}</td>
                  <td className="p-2 whitespace-pre-wrap break-all">
                    {e.target ? JSON.stringify(e.target, null, 2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
