import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';

export default async function AdminStagesList() {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from('stages').select('*').eq('edition_id', edition.id).order('number');

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Stages</h1>
      <ul className="space-y-1">
        {(stages ?? []).map((s) => (
          <li key={s.id}>
            <Link
              href={`/admin/stages/${s.number}`}
              className="flex items-center justify-between border rounded px-4 py-2 hover:bg-muted text-sm"
            >
              <span>Stage {s.number}</span>
              <span className="flex gap-2">
                {s.counts_for_scoring && <Badge variant="secondary">counted</Badge>}
                {s.double_points && <Badge variant="secondary">2×</Badge>}
                <Badge>{s.status}</Badge>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
