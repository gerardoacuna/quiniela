import { notFound, redirect } from 'next/navigation';
import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { JerseyKindPickForm } from './form';

const VALID_KINDS = ['points', 'white'] as const;
type Kind = (typeof VALID_KINDS)[number];

export default async function JerseyKindPickPage({
  params,
}: {
  params: Promise<{ kind: string }>;
}) {
  const { kind } = await params;
  if (!VALID_KINDS.includes(kind as Kind)) notFound();
  const typedKind = kind as Kind;

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const { user } = await requireProfile();
  const edition = await getActiveEdition();
  if (!edition) redirect('/home');

  const supabase = await createClient();
  const [{ data: stage1 }, { data: jerseyPick }, { data: riders }] = await Promise.all([
    supabase.from('stages').select('start_time').eq('edition_id', edition.id).eq('number', 1).maybeSingle(),
    supabase
      .from('jersey_picks')
      .select('kind, rider_id, riders!inner(id, name, team, bib, status)')
      .eq('user_id', user.id)
      .eq('edition_id', edition.id)
      .eq('kind', typedKind)
      .maybeSingle(),
    supabase
      .from('riders')
      .select('id, name, team, bib, status')
      .eq('edition_id', edition.id)
      .eq('status', 'active')
      .order('name'),
  ]);

  const isLocked = stage1 ? new Date(stage1.start_time).getTime() <= now : false;

  type JerseyRow = {
    kind: Kind;
    rider_id: string;
    riders: { id: string; name: string; team: string | null; bib: number | null; status: 'active' | 'dnf' | 'dns' };
  };
  const initialRider = (jerseyPick as unknown as JerseyRow | null)?.riders ?? null;

  return (
    <JerseyKindPickForm
      editionId={edition.id}
      kind={typedKind}
      riders={
        (riders ?? []) as Array<{
          id: string;
          name: string;
          team: string | null;
          bib: number | null;
          status: 'active' | 'dnf' | 'dns';
        }>
      }
      initialRider={initialRider}
      isLocked={isLocked}
    />
  );
}
