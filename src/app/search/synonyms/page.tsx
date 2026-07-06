'use client';

import { useCallback, useEffect, useState } from 'react';
import { searchAdminApi, SearchAdminApiError } from '@/lib/searchAdminApi';
import type { SynonymGroup } from '@/lib/searchAdminTypes';
import { Card, EmptyState, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { Plus, Trash2 } from 'lucide-react';

export default function SearchSynonymsPage() {
  const toast = useToast();
  const [groups, setGroups] = useState<SynonymGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newEntry, setNewEntry] = useState('');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await searchAdminApi.listSynonyms());
    } catch (err) {
      setError(err instanceof SearchAdminApiError ? err.message : 'Failed to load synonyms.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const terms = newEntry.split(',').map(t => t.trim()).filter(Boolean);
    if (terms.length < 2) {
      toast.push('error', 'Enter at least 2 comma-separated terms.');
      return;
    }
    setAdding(true);
    try {
      await searchAdminApi.upsertSynonyms({ synonyms: terms });
      toast.push('success', 'Synonym group saved.');
      setNewEntry('');
      await load();
    } catch (err) {
      toast.push('error', err instanceof SearchAdminApiError ? err.message : 'Save failed.');
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(term: string) {
    if (!confirm(`Delete synonym group for "${term}"?`)) return;
    setDeleting(term);
    try {
      await searchAdminApi.deleteSynonym(term);
      toast.push('success', 'Synonym deleted.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof SearchAdminApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Search Synonyms</h1>
        <p className="text-sm text-gray-500">Define synonym groups for the Meilisearch product index.</p>
      </div>

      <Card>
        <form onSubmit={handleAdd} className="flex items-end gap-3">
          <label className="flex-1 block space-y-1.5">
            <span className="label">New synonym group</span>
            <input
              className="input"
              placeholder="e.g. tomato, tomate, tameta"
              value={newEntry}
              onChange={e => setNewEntry(e.target.value)}
            />
          </label>
          <button type="submit" className="btn-primary flex items-center gap-1" disabled={adding}>
            {adding ? <Spinner className="h-4 w-4" /> : <><Plus className="h-4 w-4" /> Add</>}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400">Enter comma-separated terms that should match each other in search.</p>
      </Card>

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && groups === null ? (
          <div className="p-6"><Loading label="Loading synonyms…" /></div>
        ) : groups && groups.length === 0 ? (
          <EmptyState>No synonym groups defined yet.</EmptyState>
        ) : groups ? (
          <div className="divide-y divide-gray-50">
            {groups.map((group, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {group.synonyms.map(s => (
                    <span key={s} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{s}</span>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-ghost ml-4 p-1.5 text-red-500"
                  disabled={deleting === group.synonyms[0]}
                  onClick={() => handleDelete(group.synonyms[0])}
                >
                  {deleting === group.synonyms[0] ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
