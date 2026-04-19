import { redirect } from 'next/navigation';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { EditionForm } from './form';

export default async function AdminEditionPage() {
  const edition = await getActiveEdition();
  if (!edition) redirect('/admin');
  const supabase = await createClient();
  const { data: stages } = await supabase
    .from('stages').select('*').eq('edition_id', edition.id).order('number');
  return <EditionForm editionId={edition.id} stages={stages ?? []} />;
}
