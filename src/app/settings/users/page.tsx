'use client';

import { useCallback, useEffect, useState } from 'react';
import { UserCog, KeyRound } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import { useAuth } from '@/lib/store';
import type { AdminUser } from '@/lib/types';
import { Card, Field, Spinner, ErrorBox, EmptyState, Loading, SectionTitle, useToast } from '@/components/ui';

export default function UsersPage() {
  const toast = useToast();
  const { user: current } = useAuth();

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setUsers(await api.listUsers());
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load admin users.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canSubmit = username.trim().length > 0 && password.length >= 8;

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setFormError('Username is required and password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.createUser({ username: username.trim(), password, name: name.trim() });
      toast.push('success', `Admin "${username.trim().toLowerCase()}" created.`);
      setUsername('');
      setName('');
      setPassword('');
      await load();
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : 'Failed to create admin user.');
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(target: string) {
    const next = window.prompt(`New password for "${target}" (min 8 characters):`);
    if (next === null) return;
    if (next.length < 8) {
      toast.push('error', 'Password must be at least 8 characters.');
      return;
    }
    try {
      await api.changePassword(target, next);
      toast.push('success', `Password updated for "${target}".`);
    } catch (err) {
      toast.push('error', err instanceof ApiClientError ? err.message : 'Failed to update password.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Admin users</h1>
        <p className="text-sm text-gray-500">People who can sign in to this dashboard with a username and password.</p>
      </div>

      <Card className="max-w-xl">
        <SectionTitle>Add admin</SectionTitle>
        <form onSubmit={createUser} className="space-y-4">
          {formError && <ErrorBox message={formError} />}
          <Field label="Username" hint="Lowercased automatically. Used to sign in.">
            <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. chanda" autoComplete="off" />
          </Field>
          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Chanda Mwale" autoComplete="off" />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Temporary password" autoComplete="new-password" />
          </Field>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Create admin'}
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle>All admins</SectionTitle>
        {loadError ? (
          <ErrorBox message={loadError} />
        ) : users === null ? (
          <Loading label="Loading admins…" />
        ) : users.length === 0 ? (
          <EmptyState>No admin users yet.</EmptyState>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.username} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <UserCog className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {u.name || u.username}
                      {current?.username === u.username && <span className="ml-2 text-xs font-normal text-gray-400">(you)</span>}
                    </div>
                    <div className="text-xs text-gray-400">{u.username}</div>
                  </div>
                </div>
                <button
                  onClick={() => resetPassword(u.username)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Reset password
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
