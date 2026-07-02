'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, QrCode } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import { Card, Field, Spinner, ErrorBox, useToast } from '@/components/ui';
import { HHMM, validatePolygonLines } from '@/lib/darkstoreValidation';

export default function DarkstoreOnboardPage() {
  const toast = useToast();
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [polygon, setPolygon] = useState('');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ darkstore_id: string; name: string } | null>(null);

  function resetForm() {
    setName('');
    setLatitude('');
    setLongitude('');
    setPolygon('');
    setOpensAt('');
    setClosesAt('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setCreated(null);

    if (!name.trim()) {
      setError('Store name is required.');
      return;
    }
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (latitude.trim() === '' || Number.isNaN(lat) || lat < -90 || lat > 90) {
      setError('Latitude is required and must be between -90 and 90.');
      return;
    }
    if (longitude.trim() === '' || Number.isNaN(lng) || lng < -180 || lng > 180) {
      setError('Longitude is required and must be between -180 and 180.');
      return;
    }
    const polygonError = validatePolygonLines(polygon);
    if (polygonError) {
      setError(polygonError);
      return;
    }
    if (!HHMM.test(opensAt.trim())) {
      setError('Opens-at must be a valid HH:MM time.');
      return;
    }
    if (!HHMM.test(closesAt.trim())) {
      setError('Closes-at must be a valid HH:MM time.');
      return;
    }
    if (closesAt.trim() <= opensAt.trim()) {
      setError('Closes-at must be after opens-at.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await api.createDarkstore({
        name: name.trim(),
        latitude: lat,
        longitude: lng,
        polygon: polygon.trim() || undefined,
        opens_at: opensAt.trim(),
        closes_at: closesAt.trim()
      });
      setCreated({ darkstore_id: res.darkstore_id, name: res.name });
      toast.push('success', `Darkstore ${res.darkstore_id} created.`);
      resetForm();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to create darkstore.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Onboard darkstore</h1>
        <p className="text-sm text-gray-500">Create a new darkstore. It is created inactive — ops enables it separately.</p>
      </div>

      {created && (
        <Card className="max-w-xl border-green-200 bg-green-50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-green-800">Darkstore created</p>
              <div className="flex items-center gap-2">
                <code className="rounded bg-white px-2 py-1 font-mono text-sm">{created.darkstore_id}</code>
                <button
                  type="button"
                  className="text-green-700 hover:text-green-900"
                  onClick={() => navigator.clipboard.writeText(created.darkstore_id)}
                  title="Copy store ID"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
              <Link
                href={`/stores/qr?store=${encodeURIComponent(created.darkstore_id)}`}
                className="btn-primary inline-flex w-fit items-center gap-2"
              >
                <QrCode className="h-4 w-4" />
                View store QR
              </Link>
            </div>
          </div>
        </Card>
      )}

      <form onSubmit={submit} className="space-y-6">
        <Card className="max-w-xl space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Store name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Indiranagar Darkstore" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Latitude">
              <input className="input" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="12.9719" inputMode="decimal" />
            </Field>
            <Field label="Longitude">
              <input className="input" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="77.6412" inputMode="decimal" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Opens at">
              <input className="input" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} placeholder="07:00" type="time" />
            </Field>
            <Field label="Closes at">
              <input className="input" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} placeholder="23:00" type="time" />
            </Field>
          </div>
          <Field
            label="Serviceable-area polygon"
            hint="Optional. One 'lat,lng' pair per line, at least 3 lines if provided. Leave empty to add later."
          >
            <textarea
              className="input font-mono"
              rows={5}
              value={polygon}
              onChange={(e) => setPolygon(e.target.value)}
              placeholder={'12.96,77.62\n12.96,77.66\n12.99,77.66\n12.99,77.62'}
            />
          </Field>
        </Card>

        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? <Spinner className="h-4 w-4" /> : 'Create darkstore'}
        </button>
      </form>
    </div>
  );
}
