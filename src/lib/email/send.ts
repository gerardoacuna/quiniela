import 'server-only';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    const resend = new Resend(resendKey);
    const from = process.env.EMAIL_FROM ?? 'Quiniela <no-reply@example.com>';
    const { error } = await resend.emails.send({ from, ...input });
    if (error) throw new Error(`resend: ${error.message}`);
    return;
  }

  const smtpPort = Number(process.env.SUPABASE_SMTP_PORT ?? 54325);
  const smtpHost = process.env.SUPABASE_SMTP_HOST ?? '127.0.0.1';
  const transport = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    tls: { rejectUnauthorized: false },
  });
  const from = process.env.EMAIL_FROM ?? 'Quiniela <no-reply@quiniela.local>';
  await transport.sendMail({ from, ...input });
}
