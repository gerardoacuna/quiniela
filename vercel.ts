import type { VercelConfig } from '@vercel/config/v1';

export const config: VercelConfig = {
  framework: 'nextjs',
  buildCommand: 'next build --webpack',
  // Crons require Vercel Pro for sub-daily schedules. Re-enable when upgraded:
  //   { path: '/api/cron/scrape-pcs', schedule: '*/15 * * * *' },
  //   { path: '/api/cron/send-reminders', schedule: '0 * * * *' },
};

export default config;
