import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { pickReminder } from '@/lib/email/templates';
import { findUsersNeedingReminderForStage } from '@/lib/queries/reminders';

export interface ReminderOptions {
  now?: () => Date;
  emailer?: (to: string, subject: string, text: string) => Promise<void>;
  editionId?: string;
  windowMinutes?: number;
}

export interface ReminderResult {
  ok: boolean;
  sent: number;
  errors: string[];
}

const JOB_NAME = 'send-reminders';

export async function sendPickReminders(opts: ReminderOptions = {}): Promise<ReminderResult> {
  const admin = createAdminClient();
  const now = opts.now ? opts.now() : new Date();
  const windowMinutes = opts.windowMinutes ?? 120;
  const errors: string[] = [];
  let sent = 0;

  // 1. Record last_started_at
  await admin
    .from('cron_runs')
    .update({ last_started_at: now.toISOString() })
    .eq('job_name', JOB_NAME);

  // 2. Resolve edition
  let editionId = opts.editionId;
  if (!editionId) {
    const { data: edition } = await admin
      .from('editions')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    if (!edition) {
      return { ok: false, sent: 0, errors: ['no_active_edition'] };
    }
    editionId = edition.id;
  }

  // 3. Select stages in [now, now + window] that are not published or cancelled
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + windowMinutes * 60_000).toISOString();

  const { data: stages } = await admin
    .from('stages')
    .select('id, number, start_time')
    .eq('edition_id', editionId)
    .eq('counts_for_scoring', true)
    .gte('start_time', windowStart)
    .lte('start_time', windowEnd)
    .not('status', 'in', '("published","cancelled")');

  const site = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  // 4. For each stage, find eligible users and send reminders
  for (const stage of stages ?? []) {
    const users = await findUsersNeedingReminderForStage(stage.id);

    for (const u of users) {
      const tpl = pickReminder(
        u.display_name ?? u.email ?? 'Player',
        stage.number,
        new Date(stage.start_time),
        `${site}/picks/stage/${stage.number}`,
      );

      try {
        if (opts.emailer) {
          await opts.emailer(u.email!, tpl.subject, tpl.text);
        } else {
          await sendEmail({ to: u.email!, subject: tpl.subject, text: tpl.text });
        }

        // Insert pick_reminders_sent only after successful email
        await admin
          .from('pick_reminders_sent')
          .insert({ user_id: u.id, stage_id: stage.id });

        sent++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        errors.push(`user=${u.id}:${message}`);
      }
    }
  }

  // 5. Finalize cron_runs
  if (errors.length === 0) {
    await admin
      .from('cron_runs')
      .update({
        last_succeeded_at: now.toISOString(),
        consecutive_failures: 0,
        last_error: null,
      })
      .eq('job_name', JOB_NAME);
  } else {
    const { data } = await admin
      .from('cron_runs')
      .select('consecutive_failures')
      .eq('job_name', JOB_NAME)
      .maybeSingle();
    const next = (data?.consecutive_failures ?? 0) + 1;
    await admin
      .from('cron_runs')
      .update({ consecutive_failures: next, last_error: errors[0] })
      .eq('job_name', JOB_NAME);
  }

  return { ok: errors.length === 0, sent, errors };
}
