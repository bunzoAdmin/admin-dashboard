'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { api, ApiClientError } from '@/lib/api';
import { buildPhoneNumber, DEFAULT_COUNTRY_DIAL } from '@/lib/phone';
import { Card, ErrorBox, Spinner, Loading, StatusBadge } from '@/components/ui';
import type { Darkstore, DriverSummary } from '@/lib/types';

const UNASSIGNED = 'UNASSIGNED';
const PAGE_SIZE = 50;

export default function DriversLookupPage() {
  const router = useRouter();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL);
  const [localNumber, setLocalNumber] = useState('');

  const [stores, setStores] = useState<Darkstore[]>([]);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState('');
  const [nameQuery, setNameQuery] = useState('');

  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const storeName = useMemo(() => {
    const map = new Map(stores.map((s) => [s.darkstore_id, s.name]));
    return (id: string) => map.get(id) ?? id;
  }, [stores]);

  // Include inactive stores so riders on a since-deactivated store remain findable.
  useEffect(() => {
    api
      .listDarkstores({ all: true })
      .then((res) => setStores([...res.darkstores].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setStoresError(err instanceof ApiClientError ? err.message : 'Failed to load darkstores.'));
  }, []);

  const fetchPage = useCallback(
    async (store: string, name: string, cursor: string) => {
      const res = await api.listDrivers({
        assigned_store_id: store,
        name: name.trim() || undefined,
        cursor: cursor || undefined,
        limit: PAGE_SIZE
      });
      return res;
    },
    []
  );

  const runSearch = useCallback(
    async (store: string, name: string) => {
      if (!store) return;
      setLoading(true);
      setListError(null);
      setHasSearched(true);
      try {
        const res = await fetchPage(store, name, '');
        setDrivers(res.drivers);
        setNextCursor(res.next_cursor);
      } catch (err) {
        setDrivers([]);
        setNextCursor('');
        setListError(err instanceof ApiClientError ? err.message : 'Failed to load riders.');
      } finally {
        setLoading(false);
      }
    },
    [fetchPage]
  );

  const onStoreChange = (value: string) => {
    setSelectedStore(value);
    setNameQuery('');
    if (value) runSearch(value, '');
    else {
      setDrivers([]);
      setNextCursor('');
      setHasSearched(false);
    }
  };

  const onNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStore) runSearch(selectedStore, nameQuery);
  };

  const loadMore = async () => {
    if (!nextCursor || !selectedStore) return;
    setLoadingMore(true);
    try {
      const res = await fetchPage(selectedStore, nameQuery, nextCursor);
      setDrivers((prev) => [...prev, ...res.drivers]);
      setNextCursor(res.next_cursor);
    } catch (err) {
      setListError(err instanceof ApiClientError ? err.message : 'Failed to load more riders.');
    } finally {
      setLoadingMore(false);
    }
  };

  function onPhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = buildPhoneNumber(countryCode, localNumber);
    if (!p) return;
    router.push(`/riders/${encodeURIComponent(p)}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Riders</h1>
        <p className="text-sm text-gray-500">Look up a rider by phone number, or browse riders by their assigned darkstore.</p>
      </div>

      <Card className="max-w-xl">
        <form onSubmit={onPhoneSubmit} className="space-y-3">
          <span className="label">Look up by phone number</span>
          <div className="flex gap-2">
            <PhoneInput
              className="flex-1"
              countryCode={countryCode}
              localNumber={localNumber}
              onCountryCodeChange={setCountryCode}
              onLocalNumberChange={setLocalNumber}
            />
            <button type="submit" className="btn-primary shrink-0 self-start">
              <Search className="h-4 w-4" />
              Look up
            </button>
          </div>
          <p className="text-xs text-gray-400">Select the country code and enter the mobile number without the leading zero.</p>
        </form>
      </Card>

      <Card>
        <div className="space-y-4">
          <div>
            <span className="label mb-1.5">Browse by darkstore</span>
            <div className="flex flex-col gap-3 sm:flex-row">
              <select
                className="input sm:max-w-xs"
                value={selectedStore}
                onChange={(e) => onStoreChange(e.target.value)}
                disabled={stores.length === 0 && !selectedStore}
              >
                <option value="">Select a darkstore…</option>
                <option value={UNASSIGNED}>Unassigned</option>
                {stores.map((s) => (
                  <option key={s.darkstore_id} value={s.darkstore_id}>
                    {s.name} — #{s.darkstore_id}
                    {s.is_active ? '' : ' (inactive)'}
                  </option>
                ))}
              </select>
              <form onSubmit={onNameSubmit} className="flex flex-1 gap-2">
                <input
                  className="input flex-1"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Filter by name…"
                  disabled={!selectedStore}
                />
                <button type="submit" className="btn-ghost shrink-0" disabled={!selectedStore || loading}>
                  <Search className="h-4 w-4" />
                  Search
                </button>
              </form>
            </div>
            {storesError && <p className="mt-1.5 text-xs text-red-600">{storesError}</p>}
          </div>

          {loading && <Loading label="Loading riders…" />}
          {listError && !loading && <ErrorBox message={listError} />}

          {!loading && !listError && hasSearched && (
            <>
              {drivers.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  No riders {selectedStore === UNASSIGNED ? 'are unassigned' : `assigned to ${storeName(selectedStore)}`}
                  {nameQuery.trim() ? ` matching “${nameQuery.trim()}”.` : '.'}
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {drivers.map((d) => (
                    <li key={d.de_id}>
                      <Link
                        href={`/riders/${encodeURIComponent(d.phone_number)}`}
                        className="flex items-center gap-3 py-3 transition hover:bg-gray-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {d.profile_view_url ? (
                          <img src={d.profile_view_url} alt={d.name} className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green-light text-sm font-bold text-brand-green-dark">
                            {d.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-gray-900">{d.name || '—'}</div>
                          <div className="text-sm text-gray-500">{d.phone_number}</div>
                        </div>
                        <StatusBadge status={d.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {nextCursor && (
                <div className="flex justify-center pt-2">
                  <button className="btn-ghost" onClick={loadMore} disabled={loadingMore}>
                    {loadingMore ? <Spinner className="h-4 w-4" /> : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
