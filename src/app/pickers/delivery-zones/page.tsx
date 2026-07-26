'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { pickerApi, PickerApiError } from '@/lib/pickerApi';
import type { DeliveryZoneResponse } from '@/lib/pickerTypes';
import { StoreSelector, useStoreContext } from '@/components/pickers/StoreSelector';
import { Modal } from '@/components/Modal';
import { Badge, Card, EmptyState, ErrorBox, Field, Loading, Spinner, useToast } from '@/components/ui';

interface ZoneForm {
  color: string;
  rackNumber: string;
  displayLabel: string;
  sortOrder: string;
  active: boolean;
}

const EMPTY: ZoneForm = {
  color: '',
  rackNumber: '1',
  displayLabel: '',
  sortOrder: '0',
  active: true
};

export default function DeliveryZonesPage() {
  const toast = useToast();
  const { storeId, setStoreId } = useStoreContext();
  const [zones, setZones] = useState<DeliveryZoneResponse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeliveryZoneResponse | null>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (storeId == null) return;
    setLoadError(null);
    try {
      setZones(await pickerApi.listDeliveryZones(storeId));
    } catch (err) {
      setLoadError(err instanceof PickerApiError ? err.message : 'Failed to load delivery zones.');
    }
  }, [storeId]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(z: DeliveryZoneResponse) {
    setEditing(z);
    setForm({
      color: z.color,
      rackNumber: String(z.rackNumber),
      displayLabel: z.displayLabel,
      sortOrder: String(z.sortOrder),
      active: z.active
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const rackNumber = parseInt(form.rackNumber, 10);
    const sortOrder = parseInt(form.sortOrder, 10);
    const color = form.color.trim();
    if (!color || !Number.isFinite(rackNumber) || !Number.isFinite(sortOrder)) {
      setFormError('Color, rack number, and sort order are required.');
      return;
    }
    if (!editing && storeId == null) {
      setFormError('Select a store first.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      if (editing) {
        await pickerApi.updateDeliveryZone(editing.id, {
          color,
          rackNumber,
          displayLabel: form.displayLabel.trim() || `${color} Rack ${rackNumber}`,
          sortOrder,
          active: form.active
        });
        toast.push('success', 'Zone updated.');
      } else {
        await pickerApi.createDeliveryZone({
          storeId: storeId!,
          color,
          rackNumber,
          displayLabel: form.displayLabel.trim() || undefined,
          sortOrder,
          active: form.active
        });
        toast.push('success', 'Zone created.');
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof PickerApiError ? err.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(z: DeliveryZoneResponse) {
    if (!z.active) return;
    if (!confirm(`Deactivate zone "${z.displayLabel}"? It stays in history but leaves round-robin.`)) return;
    try {
      await pickerApi.deleteDeliveryZone(z.id);
      toast.push('success', 'Zone deactivated.');
      await load();
    } catch (err) {
      toast.push('error', err instanceof PickerApiError ? err.message : 'Deactivate failed.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Delivery zones</h1>
          <p className="text-sm text-gray-500">Rack labels assigned round-robin when pickers receive orders.</p>
        </div>
        <button type="button" className="btn-primary" disabled={storeId == null} onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add zone
        </button>
      </div>

      <Card>
        <StoreSelector storeId={storeId} onStoreChange={setStoreId} />
      </Card>

      {loadError && <ErrorBox message={loadError} />}

      <Card className="overflow-hidden p-0">
        {storeId == null ? (
          <EmptyState>Select a store to manage delivery zones.</EmptyState>
        ) : zones === null && !loadError ? (
          <div className="p-6">
            <Loading label="Loading zones…" />
          </div>
        ) : zones && zones.length === 0 ? (
          <EmptyState>No delivery zones for this store. Add racks for bag drop-off labels.</EmptyState>
        ) : zones ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Sort</th>
                  <th className="px-4 py-3 font-medium">Label</th>
                  <th className="px-4 py-3 font-medium">Color</th>
                  <th className="px-4 py-3 font-medium">Rack</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {zones.map((z) => (
                  <tr key={z.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs">{z.sortOrder}</td>
                    <td className="px-4 py-3 font-medium">{z.displayLabel}</td>
                    <td className="px-4 py-3">{z.color}</td>
                    <td className="px-4 py-3">{z.rackNumber}</td>
                    <td className="px-4 py-3">
                      <Badge tone={z.active ? 'green' : 'gray'}>{z.active ? 'Active' : 'Inactive'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button type="button" className="mr-3 text-sm text-brand-green hover:underline" onClick={() => openEdit(z)}>
                        Edit
                      </button>
                      {z.active && (
                        <button type="button" className="text-sm text-red-600 hover:underline" onClick={() => deactivate(z)}>
                          Deactivate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit zone' : 'Add zone'}>
        <form onSubmit={submit} className="space-y-4">
          {formError && <ErrorBox message={formError} />}
          <Field label="Color" hint="e.g. Blue, Red">
            <input className="input" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Rack number">
              <input className="input" type="number" min={1} value={form.rackNumber} onChange={(e) => setForm((f) => ({ ...f, rackNumber: e.target.value }))} required />
            </Field>
            <Field label="Sort order" hint="Round-robin sequence">
              <input className="input" type="number" min={0} value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))} required />
            </Field>
          </div>
          <Field label="Display label" hint="Optional — defaults to Color Rack N">
            <input className="input" value={form.displayLabel} onChange={(e) => setForm((f) => ({ ...f, displayLabel: e.target.value }))} placeholder="Blue Rack 2" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            Active (included in round-robin)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? <Spinner className="h-4 w-4" /> : editing ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
