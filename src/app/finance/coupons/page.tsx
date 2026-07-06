'use client';

import { useCallback, useEffect, useState } from 'react';
import { couponAdminApi, CouponAdminApiError } from '@/lib/couponAdminApi';
import type { CouponDefinition, CreateCouponRequest, PatchCouponRequest } from '@/lib/couponAdminTypes';
import { APPLY_ON_OPTIONS, DISCOUNT_TYPE_OPTIONS } from '@/lib/couponAdminTypes';
import { Badge, Card, EmptyState, ErrorBox, Loading, SectionTitle, Spinner, useToast } from '@/components/ui';
import { Plus, X } from 'lucide-react';

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString();
}

const BLANK_CREATE: CreateCouponRequest = {
  code: '', discountType: 'FIXED_AMOUNT', discountValue: 0,
  ruleType: 'ALWAYS', ruleConfig: '', enabled: true,
  displayHeadline: '', displayCondition: '', applyOn: 'SUBTOTAL'
};

export default function CouponsPage() {
  const toast = useToast();
  const [coupons, setCoupons] = useState<CouponDefinition[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CouponDefinition | null>(null);
  const [editPatch, setEditPatch] = useState<PatchCouponRequest>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateCouponRequest>(BLANK_CREATE);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCoupons(await couponAdminApi.list());
    } catch (err) {
      setError(err instanceof CouponAdminApiError ? err.message : 'Failed to load coupons.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggle(coupon: CouponDefinition) {
    setToggling(coupon.code);
    try {
      const updated = await couponAdminApi.patch(coupon.code, { enabled: !coupon.enabled });
      setCoupons(prev => prev?.map(c => c.code === updated.code ? updated : c) ?? null);
      toast.push('success', `Coupon ${updated.enabled ? 'enabled' : 'disabled'}.`);
    } catch (err) {
      toast.push('error', err instanceof CouponAdminApiError ? err.message : 'Toggle failed.');
    } finally {
      setToggling(null);
    }
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const updated = await couponAdminApi.patch(editing.code, editPatch);
      setCoupons(prev => prev?.map(c => c.code === updated.code ? updated : c) ?? null);
      toast.push('success', 'Coupon updated.');
      setEditing(null);
    } catch (err) {
      toast.push('error', err instanceof CouponAdminApiError ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(code: string) {
    if (!confirm(`Delete coupon ${code}? This cannot be undone.`)) return;
    setDeleting(code);
    try {
      await couponAdminApi.remove(code);
      setCoupons(prev => prev?.filter(c => c.code !== code) ?? null);
      toast.push('success', `Coupon ${code} deleted.`);
    } catch (err) {
      toast.push('error', err instanceof CouponAdminApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await couponAdminApi.create({
        ...createForm,
        ruleConfig: createForm.ruleConfig || undefined
      });
      setCoupons(prev => prev ? [...prev, created] : [created]);
      toast.push('success', `Coupon ${created.code} created.`);
      setShowCreate(false);
      setCreateForm(BLANK_CREATE);
    } catch (err) {
      toast.push('error', err instanceof CouponAdminApiError ? err.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Coupons</h1>
          <p className="text-sm text-gray-500">Manage discount codes shown in the customer app.</p>
        </div>
        <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setShowCreate(v => !v)}>
          <Plus className="h-4 w-4" /> New Coupon
        </button>
      </div>

      {showCreate && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <SectionTitle>New Coupon</SectionTitle>
            <button className="btn-ghost p-1" onClick={() => setShowCreate(false)}><X className="h-4 w-4" /></button>
          </div>
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="label">Code</span>
              <input className="input" placeholder="SAVE10" required value={createForm.code} onChange={e => setCreateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Discount Type</span>
              <select className="input" value={createForm.discountType} onChange={e => setCreateForm(f => ({ ...f, discountType: e.target.value as CreateCouponRequest['discountType'] }))}>
                {DISCOUNT_TYPE_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Value</span>
              <input className="input" type="number" min="0" step="0.01" required value={createForm.discountValue} onChange={e => setCreateForm(f => ({ ...f, discountValue: parseFloat(e.target.value) }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Rule Type</span>
              <select className="input" value={createForm.ruleType} onChange={e => setCreateForm(f => ({ ...f, ruleType: e.target.value as never }))}>
                <option value="ALWAYS">Always</option>
                <option value="MIN_ORDER_VALUE">Min order value</option>
                <option value="COMPLETED_ORDER_COUNT">Completed order count</option>
                <option value="PAYMENT_METHOD">Payment method</option>
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Rule Config (JSON)</span>
              <input className="input font-mono text-xs" placeholder='{"min":50}' value={createForm.ruleConfig} onChange={e => setCreateForm(f => ({ ...f, ruleConfig: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Apply On</span>
              <select className="input" value={createForm.applyOn} onChange={e => setCreateForm(f => ({ ...f, applyOn: e.target.value as CreateCouponRequest['applyOn'] }))}>
                {APPLY_ON_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="label">Headline</span>
              <input className="input" placeholder="10% off your order" value={createForm.displayHeadline} onChange={e => setCreateForm(f => ({ ...f, displayHeadline: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Condition text</span>
              <input className="input" placeholder="Min order K50" value={createForm.displayCondition} onChange={e => setCreateForm(f => ({ ...f, displayCondition: e.target.value }))} />
            </label>
            <div className="flex items-end">
              <button type="submit" className="btn-primary w-full" disabled={creating}>
                {creating ? <Spinner className="h-4 w-4 mx-auto" /> : 'Create'}
              </button>
            </div>
          </form>
        </Card>
      )}

      {error && <ErrorBox message={error} />}

      <Card className="overflow-hidden p-0">
        {loading && coupons === null ? (
          <div className="p-6"><Loading label="Loading coupons…" /></div>
        ) : coupons && coupons.length === 0 ? (
          <EmptyState>No coupons defined yet.</EmptyState>
        ) : coupons ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Discount</th>
                  <th className="px-4 py-3 font-medium">Rule</th>
                  <th className="px-4 py-3 font-medium">Headline</th>
                  <th className="px-4 py-3 font-medium">Enabled</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c: CouponDefinition) => (
                  <tr key={c.code} className="border-b border-gray-50 last:border-0">
                    <td className="px-4 py-3 font-mono text-xs font-bold">{c.code}</td>
                    <td className="px-4 py-3 text-xs">
                      {c.discountType === 'PERCENTAGE' ? `${c.discountValue}%` : `K${c.discountValue}`} off {c.applyOn.toLowerCase().replace(/_/g, ' ')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.ruleType.replace(/_/g, ' ')}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 text-xs text-gray-500">{c.displayHeadline ?? '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-ghost px-2 py-0.5 text-xs"
                        disabled={toggling === c.code}
                        onClick={() => handleToggle(c)}
                      >
                        {toggling === c.code ? <Spinner className="h-3 w-3" /> : (
                          <Badge tone={c.enabled ? 'green' : 'gray'}>{c.enabled ? 'On' : 'Off'}</Badge>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(c.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs"
                          onClick={() => { setEditing(c); setEditPatch({ displayHeadline: c.displayHeadline ?? '', displayCondition: c.displayCondition ?? '', discountValue: c.discountValue }); }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs text-red-600"
                          disabled={deleting === c.code}
                          onClick={() => handleDelete(c.code)}
                        >
                          {deleting === c.code ? <Spinner className="h-3 w-3" /> : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Edit {editing.code}</h2>
              <button className="btn-ghost p-1" onClick={() => setEditing(null)}><X className="h-4 w-4" /></button>
            </div>
            <label className="block space-y-1.5">
              <span className="label">Discount Value</span>
              <input className="input" type="number" min="0" step="0.01" value={editPatch.discountValue ?? ''} onChange={e => setEditPatch(p => ({ ...p, discountValue: parseFloat(e.target.value) }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Headline</span>
              <input className="input" value={editPatch.displayHeadline ?? ''} onChange={e => setEditPatch(p => ({ ...p, displayHeadline: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Condition</span>
              <input className="input" value={editPatch.displayCondition ?? ''} onChange={e => setEditPatch(p => ({ ...p, displayCondition: e.target.value }))} />
            </label>
            <label className="block space-y-1.5">
              <span className="label">Rule Config (JSON)</span>
              <input className="input font-mono text-xs" value={editPatch.ruleConfig ?? ''} onChange={e => setEditPatch(p => ({ ...p, ruleConfig: e.target.value || undefined }))} />
            </label>
            <div className="flex gap-2">
              <button className="btn-primary text-sm" disabled={saving} onClick={handleSaveEdit}>
                {saving ? <Spinner className="h-4 w-4" /> : 'Save'}
              </button>
              <button className="btn-ghost text-sm" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
