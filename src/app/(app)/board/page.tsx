import { requireProfile } from '@/lib/auth/require-user';
import { getLeaderboard } from '@/lib/queries/leaderboard';

export default async function BoardPage() {
  const { user } = await requireProfile();
  const rows = await getLeaderboard();

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Leaderboard</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No players yet.</p>
      ) : (
        <div className="border rounded overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-2 py-2 text-left">#</th>
                <th className="px-2 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-right">Total</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">Stages</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">GC</th>
                <th className="px-2 py-2 text-right hidden sm:table-cell">Jersey</th>
                <th className="px-2 py-2 text-right" title="Exact winner picks (tiebreaker)">★</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isSelf = r.user_id === user.id;
                return (
                  <tr
                    key={r.user_id}
                    className={`border-t ${isSelf ? 'bg-primary/5 font-semibold' : ''}`}
                  >
                    <td className="px-2 py-2">{r.rank}</td>
                    <td className="px-2 py-2">{r.display_name}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.total_points}</td>
                    <td className="px-2 py-2 text-right font-mono hidden sm:table-cell">{r.stage_points}</td>
                    <td className="px-2 py-2 text-right font-mono hidden sm:table-cell">{r.gc_points}</td>
                    <td className="px-2 py-2 text-right font-mono hidden sm:table-cell">{r.jersey_points}</td>
                    <td className="px-2 py-2 text-right font-mono">{r.exact_winners_count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
