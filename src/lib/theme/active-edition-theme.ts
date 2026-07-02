import 'server-only';
import { cache } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import type { EditionRow } from '@/lib/queries/stages';

// Reads the active edition with the service-role client so the THEME resolves even
// for unauthenticated requests (editions RLS is authenticated-only). Best-effort:
// returns null on any error. Cached per request.
export const getActiveEditionForTheme = cache(async (): Promise<EditionRow | null> => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('editions')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
});
