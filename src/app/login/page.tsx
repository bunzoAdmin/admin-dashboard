'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { api, ApiClientError } from '@/lib/api';
import { Field, Spinner, ErrorBox } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = username.trim().length > 0 && password.length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.login(username.trim(), password);
      login(res.token, res.user);
      router.replace('/');
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        setError('Invalid username or password.');
      } else if (err instanceof ApiClientError && err.status === 0) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Login failed.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <form onSubmit={onSubmit} className="card w-full max-w-sm space-y-5 p-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-green text-white">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Bunzo Admin</h1>
          <p className="text-sm text-gray-400">Operations console</p>
        </div>

        {error && <ErrorBox message={error} />}

        <Field label="Username">
          <input
            autoFocus
            autoComplete="username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. chanda"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy || !canSubmit}>
          {busy ? <Spinner className="h-4 w-4" /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
