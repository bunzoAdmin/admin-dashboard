'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { ShiftResponse } from '@/lib/pickerTypes';
import { PinRevealModal } from '@/components/pickers/PinRevealModal';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { PhoneInput } from '@/components/PhoneInput';
import { buildPhoneNumber, DEFAULT_COUNTRY_DIAL } from '@/lib/phone';
import { Card, ErrorBox, Field, Spinner, useToast } from '@/components/ui';

export default function OnboardPickerPage() {
  const router = useRouter();
  const toast = useToast();
  const { storeId, setStoreId } = useStoreContext();

  const [shifts, setShifts] = useState<ShiftResponse[]>([]);
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_DIAL);
  const [localNumber, setLocalNumber] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinModal, setPinModal] = useState<string | null>(null);

  const loadShifts = useCallback(async (sid: number | null) => {
    if (sid == null) { setShifts([]); setShiftId(''); return; }
    try {
      const list = await pickerApi.listShifts(sid);
      setShifts(list);
      if (list.length > 0) setShiftId(String(list[0].id));
      else setShiftId('');
    } catch {
      setShifts([]);
      setShiftId('');
    }
  }, []);

  useEffect(() => {
    loadShifts(storeId);
  }, [storeId, loadShifts]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const phone = buildPhoneNumber(countryCode, localNumber);
    const sid = parseInt(String(storeId), 10);
    const shift = parseInt(shiftId, 10);
    if (!name.trim() || !phone || !Number.isFinite(sid) || !Number.isFinite(shift)) {
      setError('Name, phone, store, and shift are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await pickerApi.registerPicker({ name: name.trim(), phone, storeId: sid, shiftId: shift });
      if (created.initialPin) {
        setPinModal(created.initialPin);
      } else {
        toast.push('success', `Picker "${created.name}" registered.`);
        router.push('/pickers');
      }
    } catch (err) {
      setError(err instanceof PickerApiError ? err.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  }

  function onPinClose() {
    setPinModal(null);
    router.push('/pickers');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Onboard picker</h1>
        <p className="text-sm text-gray-500">
          Register a new store picker.{' '}
          <Link href="/pickers/shifts" className="text-brand-green hover:underline">
            Manage shifts
          </Link>{' '}
          if none exist for this store.
        </p>
      </div>

      <Card className="max-w-lg space-y-4">
        <form onSubmit={submit} className="space-y-4">
          {error && <ErrorBox message={error} />}

          <StoreSelector storeId={storeId} onStoreChange={setStoreId} />

          <Field label="Shift">
            {storeId == null ? (
              <p className="text-sm text-amber-600">Select a store above first.</p>
            ) : shifts.length === 0 ? (
              <p className="text-sm text-amber-600">No shifts for this store. Create one under Pickers → Shifts.</p>
            ) : (
              <select className="input" value={shiftId} onChange={(e) => setShiftId(e.target.value)} required>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)})
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Full name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </Field>

          <Field label="Phone">
            <PhoneInput
              countryCode={countryCode}
              localNumber={localNumber}
              onCountryCodeChange={setCountryCode}
              onLocalNumberChange={setLocalNumber}
            />
          </Field>

          <button type="submit" className="btn-primary" disabled={busy || shifts.length === 0}>
            {busy ? <Spinner className="h-4 w-4" /> : 'Register picker'}
          </button>
        </form>
      </Card>

      <PinRevealModal open={!!pinModal} pin={pinModal} title="Picker initial PIN" onClose={onPinClose} />
    </div>
  );
}
