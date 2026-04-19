import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { parseStageResults } from '@/lib/pcs/parse-stage-results';
import { parseClassification } from '@/lib/pcs/parse-final';
import { parseStartlist } from '@/lib/pcs/parse-startlist';
import {
  pcsStageResultsUrl,
  pcsStartlistUrl,
  pcsFinalGcUrl,
  pcsFinalPointsUrl,
} from '@/lib/pcs/urls';
import { sendEmail } from '@/lib/email/send';
import { stageDraftReady } from '@/lib/email/templates';

export interface ScrapeOptions {
  fetcher?: (url: string) => Promise<string>;
  now?: () => Date;
  emailer?: (to: string, subject: string, text: string) => Promise<void>;
  raceOverride?: { slug: string; year: number };
}

export interface ScrapeResult {
  ok: boolean;
  targets: { target: string; status: 'ok' | 'error'; message?: string }[];
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

const JOB_NAME = 'scrape-pcs';

async function defaultFetcher(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': process.env.PCS_USER_AGENT ?? 'Quiniela' },
  });
  if (!res.ok) throw new Error(`pcs_${res.status}`);
  return res.text();
}

async function resolveRiderSlugs(
  supabase: SupabaseAdmin,
  editionId: string,
  slugs: string[],
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('riders')
    .select('id, pcs_slug')
    .eq('edition_id', editionId)
    .in('pcs_slug', slugs);
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    map.set(r.pcs_slug, r.id);
  }
  return map;
}

async function bumpFailures(
  supabase: SupabaseAdmin,
  jobName: string,
  msg: string,
): Promise<void> {
  const { data } = await supabase
    .from('cron_runs')
    .select('consecutive_failures')
    .eq('job_name', jobName)
    .maybeSingle();
  const next = (data?.consecutive_failures ?? 0) + 1;
  await supabase
    .from('cron_runs')
    .update({ consecutive_failures: next, last_error: msg })
    .eq('job_name', jobName);
}

async function notifyAdmins(
  supabase: SupabaseAdmin,
  stageNumber: number,
  emailer?: (to: string, subject: string, text: string) => Promise<void>,
): Promise<void> {
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('email')
      .eq('role', 'admin')
      .is('deleted_at', null);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const inspectUrl = `${appUrl}/admin/stages/${stageNumber}`;
    const { subject, text } = stageDraftReady(stageNumber, inspectUrl);

    for (const admin of admins ?? []) {
      if (!admin.email) continue;
      try {
        if (emailer) {
          await emailer(admin.email, subject, text);
        } else {
          await sendEmail({ to: admin.email, subject, text });
        }
      } catch {
        // swallow per-recipient errors
      }
    }
  } catch {
    // swallow all errors
  }
}

export async function scrapeAndPersist(opts: ScrapeOptions = {}): Promise<ScrapeResult> {
  const supabase = createAdminClient();
  const now = opts.now ? opts.now() : new Date();
  const fetcher = opts.fetcher ?? defaultFetcher;
  const targets: ScrapeResult['targets'] = [];

  // 1. Record last_started_at
  await supabase
    .from('cron_runs')
    .update({ last_started_at: now.toISOString() }).eq('job_name', JOB_NAME);

  // 2. Load active edition
  const { data: edition } = await supabase
    .from('editions')
    .select('id, start_date, end_date')
    .eq('is_active', true)
    .single();

  if (!edition) {
    targets.push({ target: 'edition', status: 'error', message: 'no_active_edition' });
    await bumpFailures(supabase, JOB_NAME, 'no_active_edition');
    return { ok: false, targets };
  }

  // 3. Resolve race slug/year
  const slug = opts.raceOverride?.slug ?? 'giro-d-italia';
  const year = opts.raceOverride?.year ?? new Date(edition.start_date).getUTCFullYear();

  // 4. Startlist — populate riders if none exist
  const { count: riderCount } = await supabase
    .from('riders')
    .select('id', { count: 'exact', head: true })
    .eq('edition_id', edition.id);

  if ((riderCount ?? 0) === 0) {
    try {
      const url = pcsStartlistUrl(slug, year);
      const html = await fetcher(url);
      const entries = parseStartlist(html);
      const rows = entries.map((e) => ({
        edition_id: edition.id,
        pcs_slug: e.rider_slug,
        name: e.rider_name,
        team: e.team_name || null,
        bib: e.bib,
        status: 'active' as const,
      }));
      const { error } = await supabase
        .from('riders')
        .upsert(rows, { onConflict: 'edition_id,pcs_slug' });
      if (error) throw error;
      targets.push({ target: 'startlist', status: 'ok' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.from('scrape_errors').insert({
        target: 'startlist',
        error: msg,
      });
      targets.push({ target: 'startlist', status: 'error', message: msg });
    }
  }

  // 5. Stage results — stages in [now - 6h, now] window, not published/cancelled
  const windowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
  const windowEnd = now.toISOString();

  const { data: stages } = await supabase
    .from('stages')
    .select('id, number, status')
    .eq('edition_id', edition.id)
    .gte('start_time', windowStart)
    .lte('start_time', windowEnd)
    .not('status', 'in', '("published","cancelled")');

  for (const stage of stages ?? []) {
    const stageTarget = `stage-${stage.number}`;
    try {
      const url = pcsStageResultsUrl(slug, year, stage.number);
      const html = await fetcher(url);
      const entries = parseStageResults(html);

      if (entries.length < 3) {
        targets.push({ target: stageTarget, status: 'error', message: 'too_few_rows' });
        continue;
      }

      const top10 = entries.slice(0, 10);
      const slugs = top10.map((e) => e.rider_slug);
      const slugToId = await resolveRiderSlugs(supabase, edition.id, slugs);

      const resultRows = top10
        .map((e) => ({
          stage_id: stage.id,
          position: e.position,
          rider_id: slugToId.get(e.rider_slug),
        }))
        .filter((r): r is { stage_id: string; position: number; rider_id: string } =>
          r.rider_id !== undefined,
        );

      if (resultRows.length === 0) {
        targets.push({ target: stageTarget, status: 'error', message: 'no_known_riders' });
        continue;
      }

      // Require positions to be contiguous from 1. publishStageResults enforces
      // the same rule at publish time, so writing a gappy draft would just block
      // the admin later with a cryptic error. Surface the unresolved slugs now.
      const sortedPositions = resultRows.map((r) => r.position).sort((a, b) => a - b);
      const contiguous = sortedPositions.every((p, i) => p === i + 1);
      if (!contiguous) {
        const unresolved = top10
          .filter((e) => !slugToId.has(e.rider_slug))
          .map((e) => `pos${e.position}:${e.rider_slug}`)
          .join(',');
        await supabase.from('scrape_errors').insert({
          target: stageTarget,
          error: `unresolved_riders:${unresolved}`,
        });
        targets.push({ target: stageTarget, status: 'error', message: 'unresolved_riders' });
        continue;
      }

      // Delete existing draft results then insert fresh
      await supabase
        .from('stage_results')
        .delete()
        .eq('stage_id', stage.id)
        .eq('status', 'draft');

      const { error: insertErr } = await supabase.from('stage_results').insert(
        resultRows.map((r) => ({ ...r, status: 'draft' as const })),
      );
      if (insertErr) throw insertErr;

      // Update stage status to results_draft
      await supabase
        .from('stages')
        .update({ status: 'results_draft' })
        .eq('id', stage.id);

      targets.push({ target: stageTarget, status: 'ok' });

      // Notify admins (swallow errors inside notifyAdmins)
      await notifyAdmins(supabase, stage.number, opts.emailer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await supabase.from('scrape_errors').insert({
        target: stageTarget,
        error: msg,
      });
      targets.push({ target: stageTarget, status: 'error', message: msg });
    }
  }

  // 6. Final classifications — after edition end AND none yet inserted
  const editionEnd = new Date(edition.end_date);
  if (now > editionEnd) {
    const { count: finalCount } = await supabase
      .from('final_classifications')
      .select('edition_id', { count: 'exact', head: true })
      .eq('edition_id', edition.id);

    if ((finalCount ?? 0) === 0) {
      const classifications: Array<['gc' | 'points_jersey', string, number]> = [
        ['gc', pcsFinalGcUrl(slug, year), 3],
        ['points_jersey', pcsFinalPointsUrl(slug, year), 1],
      ];

      for (const [kind, url, keepTop] of classifications) {
        const finalTarget = `final-${kind}`;
        try {
          const html = await fetcher(url);
          const entries = parseClassification(html);
          const topEntries = entries.slice(0, keepTop);
          const slugs = topEntries.map((e) => e.rider_slug);
          const slugToId = await resolveRiderSlugs(supabase, edition.id, slugs);

          const rows = topEntries
            .map((e, i) => ({
              edition_id: edition.id,
              kind,
              position: i + 1,
              rider_id: slugToId.get(e.rider_slug),
              status: 'draft' as const,
            }))
            .filter(
              (r): r is {
                edition_id: string;
                kind: 'gc' | 'points_jersey';
                position: number;
                rider_id: string;
                status: 'draft';
              } => r.rider_id !== undefined,
            );

          if (rows.length > 0) {
            const { error } = await supabase.from('final_classifications').insert(rows);
            if (error) throw error;
          }

          targets.push({ target: finalTarget, status: 'ok' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await supabase.from('scrape_errors').insert({
            target: finalTarget,
            error: msg,
          });
          targets.push({ target: finalTarget, status: 'error', message: msg });
        }
      }
    }
  }

  // 7. Finalize cron_runs
  const anyOk = targets.some((t) => t.status === 'ok');

  if (anyOk) {
    await supabase
      .from('cron_runs')
      .update({
        last_succeeded_at: now.toISOString(),
        consecutive_failures: 0,
        last_error: null,
      })
      .eq('job_name', JOB_NAME);
  } else if (targets.length > 0) {
    const lastMsg = targets[targets.length - 1].message ?? 'unknown';
    await bumpFailures(supabase, JOB_NAME, lastMsg);
  }

  return { ok: anyOk, targets };
}
