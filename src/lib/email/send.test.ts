import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('sendEmail adapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.RESEND_API_KEY;
    process.env.SUPABASE_SMTP_HOST = '127.0.0.1';
    process.env.SUPABASE_SMTP_PORT = '54325';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock('nodemailer');
    vi.doUnmock('resend');
  });

  it('uses nodemailer transport in local dev (no RESEND_API_KEY)', async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    vi.doMock('nodemailer', () => ({
      default: { createTransport: () => ({ sendMail }) },
    }));
    const { sendEmail } = await import('./send');
    await sendEmail({ to: 'a@b.test', subject: 'hi', text: 'hi' });
    expect(sendMail).toHaveBeenCalledOnce();
  });

  it('uses Resend when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    const resendSend = vi.fn().mockResolvedValue({ error: null });
    vi.doMock('resend', () => ({
      Resend: class { emails = { send: resendSend } },
    }));
    const { sendEmail } = await import('./send');
    await sendEmail({ to: 'a@b.test', subject: 'hi', text: 'hi' });
    expect(resendSend).toHaveBeenCalledOnce();
  });
});
