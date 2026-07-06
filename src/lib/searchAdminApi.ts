'use client';

import { inventoryApiErrorMessage, parseResponseBody } from './inventoryApiUtils';
import type { IndexStats, SearchSetting, SynonymGroup } from './searchAdminTypes';

export class SearchAdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'SearchAdminApiError';
    this.status = status;
  }
}

/** Search admin proxied through /api/admin/search (maps to search-service /admin/search). */
function searchAdminUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `/api/admin/search${normalized}`;
}

async function req<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(searchAdminUrl(path), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    });
  } catch {
    throw new SearchAdminApiError(0, 'Could not reach the search service.');
  }

  const data = await parseResponseBody(res);
  if (!res.ok) {
    throw new SearchAdminApiError(
      res.status,
      inventoryApiErrorMessage(data, res.status, 'Search request failed.')
    );
  }

  return data as T;
}

export const searchAdminApi = {
  listSynonyms: () => req<SynonymGroup[]>('/synonyms'),

  upsertSynonyms: (body: SynonymGroup) =>
    req<SynonymGroup>('/synonyms', { method: 'POST', body }),

  deleteSynonym: (term: string) =>
    req<void>(`/synonyms/${encodeURIComponent(term)}`, { method: 'DELETE' }),

  listSettings: () => req<SearchSetting[]>('/settings'),

  upsertSetting: (body: SearchSetting) =>
    req<SearchSetting>('/settings', { method: 'PUT', body }),

  syncConfig: () => req<unknown>('/sync', { method: 'POST' }),

  getIndexStats: () => req<IndexStats>('/index/stats'),

  syncIndexData: () => req<unknown>('/index/sync-data', { method: 'POST' }),

  rebuildIndex: () => req<unknown>('/index/rebuild', { method: 'POST' })
};
