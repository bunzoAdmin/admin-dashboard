'use client';

import { useCallback, useEffect, useState } from 'react';
import { searchAdminApi, SearchAdminApiError } from '@/lib/searchAdminApi';
import type { IndexStats } from '@/lib/searchAdminTypes';
import { Card, ErrorBox, Loading, Spinner, useToast } from '@/components/ui';
import { Database, RefreshCw, Zap } from 'lucide-react';

export default function SearchIndexPage() {
  const toast = useToast();
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncingData, setSyncingData] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await searchAdminApi.getIndexStats());
    } catch (err) {
      setError(err instanceof SearchAdminApiError ? err.message : 'Failed to load index stats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSyncData() {
    setSyncingData(true);
    try {
      await searchAdminApi.syncIndexData();
      toast.push('success', 'Index data sync started.');
      setTimeout(load, 3000);
    } catch (err) {
      toast.push('error', err instanceof SearchAdminApiError ? err.message : 'Sync failed.');
    } finally {
      setSyncingData(false);
    }
  }

  async function handleRebuild() {
    if (!confirm('This will delete and rebuild the entire search index. Continue?')) return;
    setRebuilding(true);
    try {
      await searchAdminApi.rebuildIndex();
      toast.push('info', 'Index rebuild triggered. This may take a few minutes.');
    } catch (err) {
      toast.push('error', err instanceof SearchAdminApiError ? err.message : 'Rebuild failed.');
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Search Index</h1>
          <p className="text-sm text-gray-500">Meilisearch index status and administration.</p>
        </div>
        <button className="btn-ghost flex items-center gap-1 text-sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {loading ? (
        <Loading label="Loading index stats…" />
      ) : stats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-blue-500" />
              <div>
                <p className="label">Documents</p>
                <p className="text-2xl font-bold text-gray-900">{stats.numberOfDocuments?.toLocaleString() ?? '—'}</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <Zap className="h-6 w-6 text-amber-500" />
              <div>
                <p className="label">Indexing</p>
                <p className="text-2xl font-bold text-gray-900">{stats.isIndexing ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </Card>
          {stats.fieldDistribution && (
            <Card>
              <p className="label mb-2">Field Distribution</p>
              <ul className="space-y-1">
                {Object.entries(stats.fieldDistribution).slice(0, 6).map(([field, count]) => (
                  <li key={field} className="flex justify-between text-xs">
                    <span className="font-mono text-gray-600">{field}</span>
                    <span className="text-gray-400">{count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold text-gray-900">Sync Product Data</h2>
          <p className="mb-4 text-sm text-gray-500">
            Push latest product catalogue changes to the search index incrementally.
          </p>
          <button
            className="btn-primary flex items-center gap-2"
            disabled={syncingData}
            onClick={handleSyncData}
          >
            {syncingData ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
            Sync Data
          </button>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-gray-900">Rebuild Index</h2>
          <p className="mb-4 text-sm text-gray-500">
            Drop and recreate the entire index from scratch. Use if the index is corrupted or out of sync.
          </p>
          <button
            className="btn-danger flex items-center gap-2"
            disabled={rebuilding}
            onClick={handleRebuild}
          >
            {rebuilding ? <Spinner className="h-4 w-4" /> : <Database className="h-4 w-4" />}
            Rebuild Index
          </button>
        </Card>
      </div>
    </div>
  );
}
