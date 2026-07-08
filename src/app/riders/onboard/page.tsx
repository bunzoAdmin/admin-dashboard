'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { PhoneInput } from '@/components/PhoneInput';
import { api, ApiClientError, uploadToS3 } from '@/lib/api';
import { buildPhoneNumber, DEFAULT_COUNTRY_DIAL } from '@/lib/phone';
import { Card, Field, Spinner, ErrorBox, useToast } from '@/components/ui';
import type { Darkstore } from '@/lib/types';

type DocKind = 'profile' | 'nrc' | 'license';

interface DocState {
  uploading: boolean;
  objectKey: string | null;
  preview: string | null;
  error: string | null;
}

const EMPTY_DOC: DocState = { uploading: false, objectKey: null, preview: null, error: null };

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL);
  const [localNumber, setLocalNumber] = useState('');
  const [name, setName] = useState('');
  const [nrcNumber, setNrcNumber] = useState('');
  const [airtelMoneyNumber, setAirtelMoneyNumber] = useState('');
  const [bikeNumber, setBikeNumber] = useState('');
  const [bikeBrand, setBikeBrand] = useState('');
  const [assignedStoreId, setAssignedStoreId] = useState('');
  const [stores, setStores] = useState<Darkstore[]>([]);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [referral, setReferral] = useState('');
  const [docs, setDocs] = useState<Record<DocKind, DocState>>({
    profile: { ...EMPTY_DOC },
    nrc: { ...EMPTY_DOC },
    license: { ...EMPTY_DOC }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullPhone = buildPhoneNumber(countryCode, localNumber);

  // Only active darkstores can be assigned at onboarding.
  useEffect(() => {
    api
      .listDarkstores({ all: false })
      .then((res) => setStores([...res.darkstores].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setStoresError(err instanceof ApiClientError ? err.message : 'Failed to load darkstores.'));
  }, []);

  async function handleFile(kind: DocKind, file: File) {
    if (!fullPhone) {
      setDocs((d) => ({ ...d, [kind]: { ...d[kind], error: 'Enter the phone number first.' } }));
      return;
    }
    setDocs((d) => ({ ...d, [kind]: { ...EMPTY_DOC, uploading: true, preview: URL.createObjectURL(file) } }));
    try {
      const presign = await api.presignDriverDoc({
        kind,
        phone: fullPhone,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size
      });
      await uploadToS3(presign.upload_url, file);
      setDocs((d) => ({ ...d, [kind]: { ...d[kind], uploading: false, objectKey: presign.object_key } }));
    } catch (err) {
      setDocs((d) => ({
        ...d,
        [kind]: { ...d[kind], uploading: false, error: err instanceof ApiClientError ? err.message : 'Upload failed.' }
      }));
    }
  }

  const allUploaded = docs.profile.objectKey && docs.nrc.objectKey && docs.license.objectKey;
  const anyUploading = docs.profile.uploading || docs.nrc.uploading || docs.license.uploading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullPhone || !name.trim()) {
      setError('Phone and name are required.');
      return;
    }
    if (!nrcNumber.trim() || !airtelMoneyNumber.trim() || !bikeNumber.trim() || !bikeBrand.trim()) {
      setError('NRC number, Airtel Money number, bike number and bike brand are all required.');
      return;
    }
    if (!assignedStoreId) {
      setError('Select the darkstore this rider is assigned to.');
      return;
    }
    if (!allUploaded) {
      setError('Upload all three documents before creating the driver.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createDriver({
        phone_number: fullPhone,
        name: name.trim(),
        profile_url: docs.profile.objectKey!,
        nrc_url: docs.nrc.objectKey!,
        driver_license_url: docs.license.objectKey!,
        nrc_number: nrcNumber.trim(),
        airtel_money_number: airtelMoneyNumber.trim(),
        bike_number: bikeNumber.trim(),
        bike_brand: bikeBrand.trim(),
        assigned_store_id: assignedStoreId,
        referral_code: referral.trim() || undefined
      });
      toast.push('success', `Driver ${name.trim()} onboarded.`);
      router.push(`/riders/${encodeURIComponent(fullPhone)}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'DE_ALREADY_EXISTS') {
        setError('A driver with this phone number already exists.');
      } else {
        setError(err instanceof ApiClientError ? err.message : 'Failed to create driver.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Onboard driver</h1>
        <p className="text-sm text-gray-500">Create a new driver and upload their verification documents.</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        <Card className="max-w-xl space-y-4">
          {error && <ErrorBox message={error} />}
          <Field label="Phone number" hint="Required before uploading documents.">
            <PhoneInput
              countryCode={countryCode}
              localNumber={localNumber}
              onCountryCodeChange={setCountryCode}
              onLocalNumberChange={setLocalNumber}
            />
          </Field>
          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Driver's full name" />
          </Field>
          <Field label="NRC number">
            <input className="input" value={nrcNumber} onChange={(e) => setNrcNumber(e.target.value)} placeholder="e.g. 123456/78/1" />
          </Field>
          <Field label="Airtel Money number">
            <input className="input" value={airtelMoneyNumber} onChange={(e) => setAirtelMoneyNumber(e.target.value)} placeholder="Airtel Money mobile number" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Bike number">
              <input className="input" value={bikeNumber} onChange={(e) => setBikeNumber(e.target.value)} placeholder="Registration plate" />
            </Field>
            <Field label="Bike brand">
              <input className="input" value={bikeBrand} onChange={(e) => setBikeBrand(e.target.value)} placeholder="e.g. Honda" />
            </Field>
          </div>
          <Field
            label="Assigned darkstore"
            hint={storesError ?? (stores.length === 0 ? 'Loading darkstores…' : 'The rider may only start duty at this store.')}
          >
            <select
              className="input"
              value={assignedStoreId}
              onChange={(e) => setAssignedStoreId(e.target.value)}
              disabled={stores.length === 0}
            >
              <option value="" disabled>
                {stores.length === 0 ? 'No active darkstores available' : 'Select a darkstore…'}
              </option>
              {stores.map((s) => (
                <option key={s.darkstore_id} value={s.darkstore_id}>
                  {s.name} — #{s.darkstore_id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Referral code" hint="Optional — code of the driver who referred them.">
            <input className="input" value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="Optional" />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Documents</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DocUpload kind="profile" label="Profile photo" state={docs.profile} disabled={!fullPhone} onFile={handleFile} />
            <DocUpload kind="nrc" label="NRC" state={docs.nrc} disabled={!fullPhone} onFile={handleFile} />
            <DocUpload kind="license" label="Driver license" state={docs.license} disabled={!fullPhone} onFile={handleFile} />
          </div>
        </Card>

        <button type="submit" className="btn-primary" disabled={busy || anyUploading || !allUploaded}>
          {busy ? <Spinner className="h-4 w-4" /> : 'Create driver'}
        </button>
      </form>
    </div>
  );
}

function DocUpload({
  kind,
  label,
  state,
  disabled,
  onFile
}: {
  kind: DocKind;
  label: string;
  state: DocState;
  disabled: boolean;
  onFile: (kind: DocKind, file: File) => void;
}) {
  return (
    <div>
      <span className="label mb-1.5">{label}</span>
      <label
        className={`relative flex h-40 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition ${
          disabled ? 'cursor-not-allowed border-gray-200 bg-gray-50' : 'border-gray-300 hover:border-brand-green'
        }`}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/heic,application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(kind, f);
          }}
        />
        {state.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={state.preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <UploadCloud className="h-6 w-6" />
            <span className="text-xs">{disabled ? 'Enter phone first' : 'Click to upload'}</span>
          </div>
        )}
        {state.uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-brand-green" />
          </div>
        )}
        {state.objectKey && !state.uploading && (
          <div className="absolute right-2 top-2 rounded-full bg-white p-0.5 shadow">
            <CheckCircle2 className="h-5 w-5 text-brand-green" />
          </div>
        )}
      </label>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
