import { requireProfile } from '@/lib/auth/require-user';
import { getActiveEdition } from '@/lib/queries/stages';
import { createClient } from '@/lib/supabase/server';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireProfile();
  const edition = await getActiveEdition();

  let nextStage: { number: number; start_time: string } | null = null;
  if (edition) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('stages')
      .select('number, start_time')
      .eq('edition_id', edition.id)
      .eq('counts_for_scoring', true)
      .gt('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (data) nextStage = data;
  }

  return (
    <AppShell
      nextStageLabel={nextStage ? `St. ${nextStage.number}` : undefined}
      nextStageIso={nextStage?.start_time}
    >
      {children}
    </AppShell>
  );
}
