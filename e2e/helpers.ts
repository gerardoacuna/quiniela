import { createClient as createSupabaseJs } from '@supabase/supabase-js';
import { Page } from '@playwright/test';
import type { Database } from '../src/lib/types/database';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !serviceKey || !anonKey) {
  throw new Error('E2E helpers require Supabase env vars (see .env.local).');
}

const admin = createSupabaseJs<Database>(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export interface TestUser {
  userId: string;
  email: string;
  password: string;
  cleanup: () => Promise<void>;
}

export async function createTestUser(role: 'player' | 'admin' = 'player'): Promise<TestUser> {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const password = 'e2e-password-12345';

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error('no user created');

  await admin.from('profiles').insert({
    id: data.user.id,
    display_name: `E2E ${data.user.id.slice(0, 6)}`,
    role,
    email,
  });

  return {
    userId: data.user.id,
    email,
    password,
    cleanup: async () => {
      await admin.from('profiles').delete().eq('id', data.user!.id);
      await admin.auth.admin.deleteUser(data.user!.id);
    },
  };
}

/** Sign the given user in via the browser page using password auth. */
export async function signInWithPassword(page: Page, email: string, password: string) {
  // Inject a session by calling signInWithPassword directly against Supabase, then
  // setting the returned tokens as cookies the same way @supabase/ssr expects.
  const response = await page.request.post(`${url}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey!, 'Content-Type': 'application/json' },
    data: { email, password },
  });
  if (!response.ok()) {
    throw new Error(`signInWithPassword failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();

  // Build a session object that satisfies @supabase/auth-js _isValidSession check:
  //   requires access_token, refresh_token, and expires_at.
  const expiresAt = Math.floor(Date.now() / 1000) + (body.expires_in as number ?? 3600);
  const session = {
    access_token: body.access_token as string,
    refresh_token: body.refresh_token as string,
    expires_at: expiresAt,
    expires_in: body.expires_in as number,
    token_type: (body.token_type as string) ?? 'bearer',
    user: body.user,
  };

  // The cookie name follows the pattern sb-<project-ref>-auth-token where project-ref
  // is the first subdomain component of SUPABASE_URL.
  // For local dev (http://127.0.0.1:54321), hostname is '127.0.0.1', split('.')[0] = '127'.
  const projectRef = new URL(url!).hostname.split('.')[0] || 'local';

  // @supabase/ssr reads the cookie via the `cookie` npm package which calls
  // decodeURIComponent on values, so we encodeURIComponent the JSON string so
  // the server gets back the plain JSON after decoding.
  const cookieValue = encodeURIComponent(JSON.stringify(session));

  await page.context().addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      url: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    },
  ]);
}
