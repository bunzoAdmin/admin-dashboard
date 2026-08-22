'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { TripReachedConfig } from '@/lib/types';
import { Card, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

const ENABLE_CONFIRM =
  'Old driver apps will fail drop complete until they mark reached. Continue?';

export default function RiderSettingsPage() {
  const toast = useToast();
  const [saved, setSaved] = useState<TripReachedConfig | null>(null);
  const [radiusMeters, setRadiusMeters] = useState('');
  const [requireReached, setRequireReached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const applyConfig = useCallback((cfg: TripReachedConfig) => {
    setSaved(cfg);
    setRadiusMeters(String(cfg.radius_meters));
    setRequireReached(cfg.require_reached_before_complete);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      applyConfig(await api.getDropReachedConfig());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load rider settings.');
    }
  }, [applyConfig]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const radius = Number(radiusMeters);
    if (!Number.isFinite(radius) || radius <= 0) {
      toast.push('error', 'Radius must be a positive number of meters.');
      return;
    }

    const turningOn = !saved?.require_reached_before_complete && requireReached;
    if (turningOn && !confirm(ENABLE_CONFIRM)) return;

    setSaving(true);
    try {
      const next = await api.patchDropReachedConfig({
        radius_meters: radius,
        require_reached_before_complete: requireReached
      });
      applyConfig(next);
      toast.push('success', 'Rider settings saved.');
    } catch (err) {
      toast.push('error', err instanceof ApiClientError ? err.message : 'Failed to save rider settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Rider Settings</h1>
        <p className="text-sm text-gray-500">
          Drop-reached radius and rollout. Distance is a warning, not a block; turning the toggle on
          breaks old driver apps that skip reached.
        </p>
      </div>

      {error && <ErrorBox message={error} />}
      {!saved && !error && <Loading label="Loading settings…" />}

      {saved && (
        <Card className="max-w-xl space-y-4">
          <Field
            label="Reached radius (meters)"
            hint="Drivers outside this radius still get a warning; drop complete is not blocked by distance."
          >
            <input
              className="input w-32"
              type="number"
              min={1}
              step={1}
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
            />
          </Field>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={requireReached}
              onChange={(e) => setRequireReached(e.target.checked)}
            />
            <span>
              Require reached before drop complete
              <span className="mt-0.5 block text-xs text-gray-400">
                Old driver apps that skip reached will fail drop complete while this is on.
              </span>
            </span>
          </label>

          <div className="flex justify-end">
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>
              {saving ? <Spinner className="h-4 w-4" /> : 'Save'}
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
