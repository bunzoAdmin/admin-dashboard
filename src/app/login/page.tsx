'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { api, ApiClientError } from '@/lib/api';
import { Field, Spinner, ErrorBox } from '@/components/ui';

export default function LoginPage() {
  const router = useRouter();
  const { login, logout } = useAuth();
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setError(null);
    // Store the key first so the API client picks it up, then verify against a
    // cheap admin-gated endpoint.
    login(key.trim(), label.trim());
    try {
      await api.listRules();
      router.replace('/drivers');
    } catch (err) {
      logout();
      if (err instanceof ApiClientError && err.status === 401) {
        setError('That admin key was rejected. Double-check and try again.');
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
          <p className="text-sm text-gray-400">Driver operations dashboard</p>
        </div>

        {error && <ErrorBox message={error} />}

        <Field label="Admin key">
          <input
            type="password"
            autoFocus
            className="input"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Shared admin key"
          />
        </Field>

        <Field label="Your name" hint="Shown in the UI and request logs for loose attribution.">
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Chanda (Ops)" />
        </Field>

        <button type="submit" className="btn-primary w-full" disabled={busy || !key.trim()}>
          {busy ? <Spinner className="h-4 w-4" /> : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
