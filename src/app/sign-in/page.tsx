'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Card } from '@/components/design/card';
import { DsButton } from '@/components/design/button';
import { Logo } from '@/components/design/logo';

type Status = 'idle' | 'sending' | 'sent' | 'error';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/auth/callback' },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Logo size={44} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              lineHeight: 1,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 22,
                color: 'var(--ink)',
                letterSpacing: -0.3,
              }}
            >
              Quiniela
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-mute)',
                letterSpacing: 1,
                marginTop: 4,
              }}
            >
              GIRO · MMXXVI
            </span>
          </div>
        </div>

        <Card pad={28} style={{ width: '100%' }}>
          {status === 'sent' ? (
            <SuccessTile
              onReset={() => {
                setStatus('idle');
                setEmail('');
              }}
            />
          ) : (
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: 1.4,
                    color: 'var(--ink-mute)',
                    textTransform: 'uppercase',
                    marginBottom: 4,
                  }}
                >
                  Sign in
                </div>
                <h1
                  style={{
                    margin: 0,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 28,
                    lineHeight: 1.1,
                    color: 'var(--ink)',
                    letterSpacing: -0.4,
                  }}
                >
                  Welcome back
                </h1>
                <p
                  style={{
                    margin: '6px 0 0',
                    fontSize: 13,
                    color: 'var(--ink-soft)',
                  }}
                >
                  Enter your email to receive a magic link.
                </p>
              </div>

              <label
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: 1.2,
                    color: 'var(--ink-mute)',
                    textTransform: 'uppercase',
                  }}
                >
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="you@example.com"
                  style={{
                    background: 'var(--surface-alt)',
                    border: `1px solid ${emailFocused ? 'var(--accent)' : 'var(--hair)'}`,
                    color: 'var(--ink)',
                    borderRadius: 'var(--radius)',
                    padding: '10px 12px',
                    fontSize: 14,
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    transition: 'border-color 120ms ease',
                  }}
                />
              </label>

              {status === 'error' && (
                <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>
                  {errorMessage}
                </p>
              )}

              <DsButton
                type="submit"
                variant="accent"
                size="lg"
                full
                disabled={status === 'sending'}
              >
                {status === 'sending' ? 'Sending…' : 'Send magic link'}
              </DsButton>
            </form>
          )}
        </Card>

        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: 'var(--ink-mute)',
            fontFamily: 'var(--font-mono)',
            textAlign: 'center',
            letterSpacing: 0.4,
          }}
        >
          Private Giro 2026 pickem · invite-only
        </p>
      </div>
    </main>
  );
}

function SuccessTile({ onReset }: { onReset: () => void }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: 1.4,
          color: 'var(--ok)',
          textTransform: 'uppercase',
        }}
      >
        Sent
      </div>
      <h2
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: 22,
          lineHeight: 1.1,
          color: 'var(--ink)',
        }}
      >
        Magic link sent
      </h2>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
        Check your inbox for a sign-in link. It expires in 1 hour.
      </p>
      <DsButton
        type="button"
        variant="ghost"
        size="md"
        full
        onClick={onReset}
      >
        Send another
      </DsButton>
    </div>
  );
}
