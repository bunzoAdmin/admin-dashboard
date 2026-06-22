'use client';

import { useMemo, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Field, Spinner, ErrorBox, useToast } from '@/components/ui';
import type { AccumulatorSpec, RankingSpec, RateModifierSpec, Rule, RuleFamily } from '@/lib/types';

const FAMILIES: { id: RuleFamily; label: string; blurb: string }[] = [
  { id: 'rate_modifier', label: 'Rate modifier', blurb: 'Boost per-trip fare during set days/times (surge, flat add-on).' },
  { id: 'accumulator', label: 'Accumulator', blurb: 'Reward when a driver hits a trip threshold in a window.' },
  { id: 'ranking', label: 'Ranking', blurb: 'Reward the top-N drivers in a weekly leaderboard.' }
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Draft {
  id: string;
  name: string;
  family: RuleFamily;
  enabled: boolean;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string;
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  multiplier: number;
  flatZmw: number;
  metric: string;
  accWindow: 'daily' | 'weekly';
  threshold: number;
  requireNoFail: boolean;
  minOnTimeRate: number;
  topN: number;
  minOnTime: number;
  weightRate: number;
  weightVolume: number;
  rewardKind: 'cash' | 'in_kind';
  rewardAmount: number;
  rewardLabel: string;
  rewardSku: string;
}

function isoToLocalInput(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function localInputToIso(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function draftFromRule(rule: Rule): Draft {
  const spec = (rule.spec ?? {}) as Partial<RateModifierSpec & AccumulatorSpec & RankingSpec>;
  const reward = (spec as Partial<AccumulatorSpec>).reward ?? { kind: 'cash', amount_zmw: 0, label: '', sku: '' };
  return {
    id: rule.id,
    name: rule.name,
    family: rule.family,
    enabled: rule.enabled,
    priority: rule.priority ?? 0,
    effectiveFrom: isoToLocalInput(rule.effective_from),
    effectiveTo: isoToLocalInput(rule.effective_to),
    daysOfWeek: (spec as RateModifierSpec).days_of_week ?? [],
    startTime: (spec as RateModifierSpec).start_time ?? '',
    endTime: (spec as RateModifierSpec).end_time ?? '',
    multiplier: (spec as RateModifierSpec).multiplier ?? 1,
    flatZmw: (spec as RateModifierSpec).flat_zmw ?? 0,
    metric: (spec as AccumulatorSpec).metric ?? 'on_time_trips',
    accWindow: ((spec as AccumulatorSpec).window as 'daily' | 'weekly') ?? 'daily',
    threshold: (spec as AccumulatorSpec).threshold ?? 1,
    requireNoFail: (spec as AccumulatorSpec).require_no_fail ?? false,
    minOnTimeRate: (spec as AccumulatorSpec).min_on_time_rate ?? 0,
    topN: (spec as RankingSpec).top_n ?? 1,
    minOnTime: (spec as RankingSpec).min_on_time ?? 0,
    weightRate: (spec as RankingSpec).weight_rate ?? 0.5,
    weightVolume: (spec as RankingSpec).weight_volume ?? 0.5,
    rewardKind: (reward.kind as 'cash' | 'in_kind') ?? 'cash',
    rewardAmount: reward.amount_zmw ?? 0,
    rewardLabel: reward.label ?? '',
    rewardSku: reward.sku ?? ''
  };
}

function emptyDraft(): Draft {
  return {
    id: '',
    name: '',
    family: 'rate_modifier',
    enabled: true,
    priority: 0,
    effectiveFrom: '',
    effectiveTo: '',
    daysOfWeek: [],
    startTime: '',
    endTime: '',
    multiplier: 1,
    flatZmw: 0,
    metric: 'on_time_trips',
    accWindow: 'daily',
    threshold: 1,
    requireNoFail: false,
    minOnTimeRate: 0,
    topN: 1,
    minOnTime: 0,
    weightRate: 0.5,
    weightVolume: 0.5,
    rewardKind: 'cash',
    rewardAmount: 0,
    rewardLabel: '',
    rewardSku: ''
  };
}

function buildSpec(d: Draft): RateModifierSpec | AccumulatorSpec | RankingSpec {
  const reward = { kind: d.rewardKind, amount_zmw: d.rewardKind === 'cash' ? d.rewardAmount : 0, label: d.rewardLabel, sku: d.rewardSku };
  if (d.family === 'rate_modifier') {
    return { days_of_week: d.daysOfWeek, start_time: d.startTime, end_time: d.endTime, multiplier: d.multiplier, flat_zmw: d.flatZmw };
  }
  if (d.family === 'accumulator') {
    return { metric: d.metric, window: d.accWindow, threshold: d.threshold, require_no_fail: d.requireNoFail, min_on_time_rate: d.minOnTimeRate, reward };
  }
  return { window: 'weekly', top_n: d.topN, min_on_time: d.minOnTime, weight_rate: d.weightRate, weight_volume: d.weightVolume, reward };
}

function validate(d: Draft): string | null {
  if (!d.id.trim()) return 'Rule ID is required.';
  if (!d.name.trim()) return 'Name is required.';
  if (d.effectiveFrom && d.effectiveTo && new Date(d.effectiveFrom) > new Date(d.effectiveTo)) {
    return 'Effective end must be on or after effective start.';
  }
  if (d.family === 'rate_modifier') {
    if (d.multiplier < 1) return 'Multiplier must be at least 1.';
    if (d.flatZmw < 0) return 'Flat amount must be 0 or more.';
  }
  if (d.family === 'accumulator') {
    if (d.threshold <= 0) return 'Threshold must be greater than 0.';
    if (d.minOnTimeRate < 0 || d.minOnTimeRate > 1) return 'Min on-time rate must be between 0 and 1.';
  }
  if (d.family === 'ranking') {
    if (d.topN <= 0) return 'Top N must be greater than 0.';
    if (d.weightRate < 0 || d.weightVolume < 0) return 'Weights must be 0 or more.';
  }
  return null;
}

export function RuleEditor({
  mode,
  initial,
  onClose,
  onSaved
}: {
  mode: 'create' | 'edit';
  initial?: Rule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState<Draft>(() => (initial ? draftFromRule(initial) : emptyDraft()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const num = (v: string) => (v === '' ? 0 : Number(v));

  const familyMeta = useMemo(() => FAMILIES.find((f) => f.id === d.family)!, [d.family]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err = validate(d);
    if (err) {
      setError(err);
      return;
    }
    setBusy(true);
    setError(null);
    const rule: Rule = {
      id: d.id.trim(),
      name: d.name.trim(),
      family: d.family,
      enabled: d.enabled,
      priority: d.priority,
      effective_from: localInputToIso(d.effectiveFrom),
      effective_to: localInputToIso(d.effectiveTo),
      version: initial?.version ?? 0,
      spec: buildSpec(d)
    };
    try {
      if (mode === 'create') await api.createRule(rule);
      else await api.updateRule(rule.id, rule);
      toast.push('success', `Rule "${rule.name}" ${mode === 'create' ? 'created' : 'updated'}.`);
      onSaved();
      onClose();
    } catch (err2) {
      setError(err2 instanceof ApiClientError ? err2.message : 'Failed to save rule.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={mode === 'create' ? 'New payout rule' : `Edit rule · ${d.name}`}>
      <form onSubmit={save} className="space-y-4">
        {error && <ErrorBox message={error} />}

        {mode === 'create' && (
          <Field label="Rule family">
            <div className="space-y-2">
              {FAMILIES.map((f) => (
                <label key={f.id} className={`flex cursor-pointer gap-3 rounded-lg border p-3 ${d.family === f.id ? 'border-brand-green bg-brand-green-light' : 'border-gray-200'}`}>
                  <input type="radio" name="family" checked={d.family === f.id} onChange={() => set('family', f.id)} className="mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{f.label}</div>
                    <div className="text-xs text-gray-500">{f.blurb}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>
        )}
        {mode === 'edit' && <p className="text-xs text-gray-400">Family: {familyMeta.label} · saving creates version v{(initial?.version ?? 0) + 1}.</p>}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rule ID">
            <input className="input" value={d.id} onChange={(e) => set('id', e.target.value)} disabled={mode === 'edit'} placeholder="e.g. weekend_surge" />
          </Field>
          <Field label="Priority">
            <input className="input" type="number" value={d.priority} onChange={(e) => set('priority', num(e.target.value))} />
          </Field>
        </div>

        <Field label="Name">
          <input className="input" value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="Human-readable name" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Effective from" hint="Optional">
            <input className="input" type="datetime-local" value={d.effectiveFrom} onChange={(e) => set('effectiveFrom', e.target.value)} />
          </Field>
          <Field label="Effective to" hint="Optional">
            <input className="input" type="datetime-local" value={d.effectiveTo} onChange={(e) => set('effectiveTo', e.target.value)} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={d.enabled} onChange={(e) => set('enabled', e.target.checked)} />
          Enabled
        </label>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">{familyMeta.label} settings</div>

          {d.family === 'rate_modifier' && (
            <div className="space-y-3">
              <div>
                <span className="label mb-1.5">Days of week</span>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((day, i) => {
                    const on = d.daysOfWeek.includes(i);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => set('daysOfWeek', on ? d.daysOfWeek.filter((x) => x !== i) : [...d.daysOfWeek, i])}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium ${on ? 'bg-brand-green text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
                <span className="mt-1 block text-xs text-gray-400">Leave all off to apply every day.</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Start time" hint="HH:MM, optional">
                  <input className="input" type="time" value={d.startTime} onChange={(e) => set('startTime', e.target.value)} />
                </Field>
                <Field label="End time" hint="HH:MM, optional">
                  <input className="input" type="time" value={d.endTime} onChange={(e) => set('endTime', e.target.value)} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Multiplier" hint="≥ 1.0">
                  <input className="input" type="number" step="0.1" min="1" value={d.multiplier} onChange={(e) => set('multiplier', num(e.target.value))} />
                </Field>
                <Field label="Flat add-on (ZMW)" hint="≥ 0">
                  <input className="input" type="number" step="0.5" min="0" value={d.flatZmw} onChange={(e) => set('flatZmw', num(e.target.value))} />
                </Field>
              </div>
            </div>
          )}

          {d.family === 'accumulator' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Metric">
                  <input className="input" value={d.metric} onChange={(e) => set('metric', e.target.value)} placeholder="on_time_trips" />
                </Field>
                <Field label="Window">
                  <select className="input" value={d.accWindow} onChange={(e) => set('accWindow', e.target.value as 'daily' | 'weekly')}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Threshold" hint="> 0">
                  <input className="input" type="number" min="1" value={d.threshold} onChange={(e) => set('threshold', num(e.target.value))} />
                </Field>
                <Field label="Min on-time rate" hint="0 to 1; 0 = ignore">
                  <input className="input" type="number" step="0.01" min="0" max="1" value={d.minOnTimeRate} onChange={(e) => set('minOnTimeRate', num(e.target.value))} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={d.requireNoFail} onChange={(e) => set('requireNoFail', e.target.checked)} />
                Require no failed trips
              </label>
              <RewardFields d={d} set={set} num={num} />
            </div>
          )}

          {d.family === 'ranking' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">Window is fixed to weekly for ranking rules.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Top N" hint="> 0">
                  <input className="input" type="number" min="1" value={d.topN} onChange={(e) => set('topN', num(e.target.value))} />
                </Field>
                <Field label="Min on-time (floor)">
                  <input className="input" type="number" min="0" value={d.minOnTime} onChange={(e) => set('minOnTime', num(e.target.value))} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Weight: rate">
                  <input className="input" type="number" step="0.1" min="0" value={d.weightRate} onChange={(e) => set('weightRate', num(e.target.value))} />
                </Field>
                <Field label="Weight: volume">
                  <input className="input" type="number" step="0.1" min="0" value={d.weightVolume} onChange={(e) => set('weightVolume', num(e.target.value))} />
                </Field>
              </div>
              <RewardFields d={d} set={set} num={num} />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? <Spinner className="h-4 w-4" /> : mode === 'create' ? 'Create rule' : 'Save new version'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RewardFields({
  d,
  set,
  num
}: {
  d: Draft;
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void;
  num: (v: string) => number;
}) {
  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Reward</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Kind">
          <select className="input" value={d.rewardKind} onChange={(e) => set('rewardKind', e.target.value as 'cash' | 'in_kind')}>
            <option value="cash">Cash</option>
            <option value="in_kind">In-kind</option>
          </select>
        </Field>
        {d.rewardKind === 'cash' ? (
          <Field label="Amount (ZMW)">
            <input className="input" type="number" step="0.5" min="0" value={d.rewardAmount} onChange={(e) => set('rewardAmount', num(e.target.value))} />
          </Field>
        ) : (
          <Field label="SKU">
            <input className="input" value={d.rewardSku} onChange={(e) => set('rewardSku', e.target.value)} />
          </Field>
        )}
      </div>
      {d.rewardKind === 'in_kind' && (
        <Field label="Label" className="mt-3">
          <input className="input" value={d.rewardLabel} onChange={(e) => set('rewardLabel', e.target.value)} placeholder="e.g. Free airtime" />
        </Field>
      )}
    </div>
  );
}
