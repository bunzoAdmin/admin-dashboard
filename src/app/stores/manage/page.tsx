'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import { Card, Field, Spinner, ErrorBox, Badge, Loading, useToast } from '@/components/ui';
import { HHMM, validatePolygonLines } from '@/lib/darkstoreValidation';
import type { Darkstore } from '@/lib/types';

function polygonToText(polygon: Darkstore['polygon']): string {
  return (polygon ?? []).map((p) => `${p.lat},${p.lng}`).join('\n');
}

function ManageStorePageContent() {
  const params = useSearchParams();
  const toast = useToast();

  const [storeIdInput, setStoreIdInput] = useState(params.get('store')?.trim() ?? '');
  const [store, setStore] = useState<Darkstore | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Full darkstore list powers the name picker. Includes inactive stores so
  // they can be selected and reactivated. A failed load degrades gracefully to
  // the manual ID field below.
  const [stores, setStores] = useState<Darkstore[]>([]);
  const [storesError, setStoresError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [polygonText, setPolygonText] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [presenceRadius, setPresenceRadius] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) return;
    setName(store.name);
    setLatitude(String(store.latitude));
    setLongitude(String(store.longitude));
    setPolygonText(polygonToText(store.polygon));
    setOpensAt(store.opens_at);
    setClosesAt(store.closes_at);
    setPresenceRadius(String(store.presence_radius_meters));
  }, [store]);

  async function loadStore(id: string) {
    const trimmed = id.trim();
    if (!trimmed) return;
    setStoreIdInput(trimmed);
    setLoading(true);
    setLoadError(null);
    setStore(null);
    try {
      const res = await api.getDarkstore(trimmed);
      setStore(res);
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : 'Failed to load store.');
    } finally {
      setLoading(false);
    }
  }

  function handleLoadSubmit(e: React.FormEvent) {
    e.preventDefault();
    loadStore(storeIdInput);
  }

  useEffect(() => {
    api
      .listDarkstores()
      .then((res) => {
        const sorted = [...res.darkstores].sort((a, b) => a.name.localeCompare(b.name));
        setStores(sorted);
      })
      .catch((err) => setStoresError(err instanceof ApiClientError ? err.message : 'Failed to load store list.'));
  }, []);

  useEffect(() => {
    if (storeIdInput.trim()) {
      loadStore(storeIdInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildPatch(): Record<string, string | number> {
    if (!store) return {};
    const patch: Record<string, string | number> = {};
    if (name.trim() !== store.name) patch.name = name.trim();
    if (latitude.trim() !== String(store.latitude)) patch.latitude = Number(latitude);
    if (longitude.trim() !== String(store.longitude)) patch.longitude = Number(longitude);
    if (polygonText.trim() !== polygonToText(store.polygon)) patch.polygon = polygonText.trim();
    if (opensAt.trim() !== store.opens_at) patch.opens_at = opensAt.trim();
    if (closesAt.trim() !== store.closes_at) patch.closes_at = closesAt.trim();
    if (presenceRadius.trim() !== String(store.presence_radius_meters)) {
      patch.presence_radius_meters = Number(presenceRadius);
    }
    return patch;
  }

  async function saveChanges(e: React.FormEvent) {
    e.preventDefault();
    if (!store) return;
    setSaveError(null);

    if (!name.trim()) {
      setSaveError('Store name is required.');
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (latitude.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
      setSaveError('Latitude is required and must be between -90 and 90.');
      return;
    }
    if (longitude.trim() === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
      setSaveError('Longitude is required and must be between -180 and 180.');
      return;
    }
    const polygonErr = validatePolygonLines(polygonText);
    if (polygonErr) {
      setSaveError(polygonErr);
      return;
    }
    if (!HHMM.test(opensAt.trim())) {
      setSaveError('Opens-at must be a valid HH:MM time.');
      return;
    }
    if (!HHMM.test(closesAt.trim())) {
      setSaveError('Closes-at must be a valid HH:MM time.');
      return;
    }
    if (closesAt.trim() <= opensAt.trim()) {
      setSaveError('Closes-at must be after opens-at.');
      return;
    }
    const radius = Number(presenceRadius);
    if (presenceRadius.trim() !== '' && (Number.isNaN(radius) || radius < 0)) {
      setSaveError('Presence radius must be a non-negative number.');
      return;
    }

    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      toast.push('info', 'No changes to save.');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.updateDarkstore(store.darkstore_id, patch);
      setStore(updated);
      toast.push('success', 'Darkstore updated.');
    } catch (err) {
      setSaveError(err instanceof ApiClientError ? err.message : 'Failed to update darkstore.');
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!store) return;
    setActivating(true);
    setActivateError(null);
    try {
      const updated = await api.activateDarkstore(store.darkstore_id);
      setStore(updated);
      toast.push('success', 'Darkstore activated.');
    } catch (err) {
      setActivateError(err instanceof ApiClientError ? err.message : 'Failed to activate darkstore.');
    } finally {
      setActivating(false);
    }
  }

  async function deactivate() {
    if (!store) return;
    setActivating(true);
    setActivateError(null);
    try {
      const updated = await api.deactivateDarkstore(store.darkstore_id);
      setStore(updated);
      toast.push('success', 'Darkstore deactivated.');
    } catch (err) {
      setActivateError(err instanceof ApiClientError ? err.message : 'Failed to deactivate darkstore.');
    } finally {
      setActivating(false);
    }
  }

  const pendingPatch = store ? Object.keys(buildPatch()).length > 0 : false;
  const locationLocked = store?.is_active ?? false;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Manage darkstore</h1>
        <p className="text-sm text-gray-500">Select a store by name to edit its details or activate/deactivate it.</p>
      </div>

      <Card className="max-w-xl space-y-4">
        <Field
          label="Select store"
          hint={storesError ?? (stores.length === 0 ? 'Loading stores…' : 'Pick a store to load its details.')}
        >
          <select
            className="input"
            value={store?.darkstore_id ?? ''}
            onChange={(e) => {
              if (e.target.value) loadStore(e.target.value);
            }}
            disabled={stores.length === 0 || loading}
          >
            <option value="" disabled>
              {stores.length === 0 ? 'No stores available' : 'Select a store…'}
            </option>
            {stores.map((s) => (
              <option key={s.darkstore_id} value={s.darkstore_id}>
                {s.name} — #{s.darkstore_id}
                {s.is_active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </Field>

        <form onSubmit={handleLoadSubmit} className="flex flex-wrap items-end gap-3">
          <Field label="Or load by store ID" className="min-w-[12rem] flex-1">
            <input
              className="input font-mono"
              value={storeIdInput}
              onChange={(e) => setStoreIdInput(e.target.value)}
              placeholder="221"
            />
          </Field>
          <button type="submit" className="btn-primary shrink-0" disabled={!storeIdInput.trim() || loading}>
            {loading ? <Spinner className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            Load
          </button>
        </form>
        {loadError && <ErrorBox message={loadError} />}
      </Card>

      {loading && !store && <Loading label="Loading store…" />}

      {store && (
        <>
          <Card className="max-w-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">
                {store.name} <span className="font-mono text-gray-400">#{store.darkstore_id}</span>
              </h2>
              <Badge tone={store.is_active ? 'green' : 'gray'}>{store.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>

            {saveError && <ErrorBox message={saveError} />}

            <form onSubmit={saveChanges} className="space-y-4">
              <Field label="Store name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Latitude" hint={locationLocked ? 'Deactivate to edit location fields.' : undefined}>
                  <input
                    className="input"
                    value={latitude}
                    onChange={(e) => setLatitude(e.target.value)}
                    disabled={locationLocked}
                    inputMode="decimal"
                  />
                </Field>
                <Field label="Longitude" hint={locationLocked ? 'Deactivate to edit location fields.' : undefined}>
                  <input
                    className="input"
                    value={longitude}
                    onChange={(e) => setLongitude(e.target.value)}
                    disabled={locationLocked}
                    inputMode="decimal"
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Opens at">
                  <input className="input" type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
                </Field>
                <Field label="Closes at">
                  <input className="input" type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
                </Field>
              </div>
              <Field label="Presence radius (meters)" hint="On-duty geofence radius. Defaults to 75m.">
                <input
                  className="input"
                  value={presenceRadius}
                  onChange={(e) => setPresenceRadius(e.target.value)}
                  inputMode="decimal"
                />
              </Field>
              <Field
                label="Serviceable-area polygon"
                hint={
                  locationLocked
                    ? 'Deactivate to edit the polygon.'
                    : "One 'lat,lng' pair per line, at least 3 lines if provided. Leave empty to clear."
                }
              >
                <textarea
                  className="input font-mono"
                  rows={5}
                  value={polygonText}
                  onChange={(e) => setPolygonText(e.target.value)}
                  disabled={locationLocked}
                />
              </Field>

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? <Spinner className="h-4 w-4" /> : 'Save changes'}
              </button>
            </form>
          </Card>

          <Card className="max-w-xl space-y-3">
            <h2 className="text-base font-semibold text-gray-900">Status</h2>
            {activateError && <ErrorBox message={activateError} />}
            {!store.activation_ready && store.activation_blockers && store.activation_blockers.length > 0 && (
              <p className="text-sm text-amber-700">Cannot activate: {store.activation_blockers.join('; ')}</p>
            )}
            {pendingPatch && <p className="text-sm text-amber-700">Save your changes before activating.</p>}
            {store.is_active ? (
              <button type="button" className="btn-ghost" onClick={deactivate} disabled={activating}>
                {activating ? <Spinner className="h-4 w-4" /> : 'Deactivate'}
              </button>
            ) : (
              <button
                type="button"
                className="btn-primary"
                onClick={activate}
                disabled={activating || !store.activation_ready || pendingPatch}
              >
                {activating ? <Spinner className="h-4 w-4" /> : 'Activate'}
              </button>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

export default function ManageStorePage() {
  return (
    <Suspense fallback={<Loading label="Loading…" />}>
      <ManageStorePageContent />
    </Suspense>
  );
}
