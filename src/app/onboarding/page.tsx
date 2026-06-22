'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { UploadCloud, CheckCircle2, Loader2 } from 'lucide-react';
import { api, ApiClientError, uploadToS3 } from '@/lib/api';
import { Card, Field, Spinner, ErrorBox, useToast } from '@/components/ui';

type DocKind = 'profile' | 'nrc' | 'license';

interface DocState {
  uploading: boolean;
  objectKey: string | null;
  preview: string | null;
  error: string | null;
}

const EMPTY_DOC: DocState = { uploading: false, objectKey: null, preview: null, error: null };

function normalizePhone(raw: string): string {
  const p = raw.trim();
  if (!p) return '';
  return p.startsWith('+') ? p : '+' + p.replace(/^\+*/, '');
}

export default function OnboardingPage() {
  const router = useRouter();
  const toast = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [referral, setReferral] = useState('');
  const [docs, setDocs] = useState<Record<DocKind, DocState>>({
    profile: { ...EMPTY_DOC },
    nrc: { ...EMPTY_DOC },
    license: { ...EMPTY_DOC }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(kind: DocKind, file: File) {
    const p = normalizePhone(phone);
    if (!p) {
      setDocs((d) => ({ ...d, [kind]: { ...d[kind], error: 'Enter the phone number first.' } }));
      return;
    }
    setDocs((d) => ({ ...d, [kind]: { ...EMPTY_DOC, uploading: true, preview: URL.createObjectURL(file) } }));
    try {
      const presign = await api.presignDriverDoc({
        kind,
        phone: p,
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
    const p = normalizePhone(phone);
    if (!p || !name.trim()) {
      setError('Phone and name are required.');
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
        phone_number: p,
        name: name.trim(),
        profile_url: docs.profile.objectKey!,
        nrc_url: docs.nrc.objectKey!,
        driver_license_url: docs.license.objectKey!,
        referral_code: referral.trim() || undefined
      });
      toast.push('success', `Driver ${name.trim()} onboarded.`);
      router.push(`/drivers/${encodeURIComponent(p)}`);
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
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+260970000000" inputMode="tel" />
          </Field>
          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Driver's full name" />
          </Field>
          <Field label="Referral code" hint="Optional — code of the driver who referred them.">
            <input className="input" value={referral} onChange={(e) => setReferral(e.target.value)} placeholder="Optional" />
          </Field>
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold text-gray-900">Documents</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <DocUpload kind="profile" label="Profile photo" state={docs.profile} disabled={!phone.trim()} onFile={handleFile} />
            <DocUpload kind="nrc" label="NRC" state={docs.nrc} disabled={!phone.trim()} onFile={handleFile} />
            <DocUpload kind="license" label="Driver license" state={docs.license} disabled={!phone.trim()} onFile={handleFile} />
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
