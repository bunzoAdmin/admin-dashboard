'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiClientError } from '@/lib/api';
import {
  canClearAmount,
  canClearPunctuality,
  canRemoveShiftStart,
  dayStartLabel,
  formatSignedMinutes,
  noShiftStartMessage,
  presenceRowStart,
  signedClearAmount,
  listedShiftStarts,
  punctualityClass,
  punctualityTone
} from '@/lib/punctualityDisplay';
import type { PunctualityReport } from '@/lib/types';
import { Card, ErrorBox, Field, Loading, formatDate } from '@/components/ui';

function clock(value: string): string {
  return value.trim().slice(0, 5);
}

export function PunctualityCard({ phone, date }: { phone: string; date: string }) {
  const [data, setData] = useState<PunctualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addDraft, setAddDraft] = useState('');
  const [replaceDrafts, setReplaceDrafts] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [clearHours, setClearHours] = useState('0');
  const [clearMinutes, setClearMinutes] = useState('0');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await api.getDriverPunctuality(phone, date);
      setData(report);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load punctuality.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [phone, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(action: () => Promise<unknown>, fallback: string) {
    setSaving(true);
    setActionError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : fallback);
    } finally {
      setSaving(false);
    }
  }

  async function addShift(e: FormEvent) {
    e.preventDefault();
    const next = clock(addDraft);
    if (!next) return;
    await run(async () => {
      await api.addDriverShiftStart(phone, next);
      setAddDraft('');
    }, 'Failed to add the shift start.');
  }

  async function replaceShift(from: string) {
    const next = clock(replaceDrafts[from] ?? from);
    if (!next || next === from) return;
    await run(() => api.replaceDriverShiftStart(phone, from, next), 'Failed to replace the shift start.');
  }

  async function removeShift(time: string) {
    await run(() => api.removeDriverShiftStart(phone, time), 'Failed to remove the shift start.');
  }

  async function clearAggregate() {
    if (!data || !canClearPunctuality(data.open_minutes) || !note.trim()) return;
    setClearing(true);
    setActionError(null);
    try {
      await api.clearDriverPunctuality(phone, note.trim());
      setNote('');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Failed to clear the aggregate.');
    } finally {
      setClearing(false);
    }
  }

  async function clearTypedAmount(e: FormEvent) {
    e.preventDefault();
    const hours = Number(clearHours);
    const minutes = Number(clearMinutes);
    if (!data || !canClearAmount(data.open_minutes, hours, minutes) || !note.trim()) return;
    setClearing(true);
    setActionError(null);
    try {
      await api.clearDriverPunctuality(phone, note.trim(), { hours, minutes });
      setNote('');
      setClearHours('0');
      setClearMinutes('0');
      await load();
    } catch (err) {
      setActionError(err instanceof ApiClientError ? err.message : 'Failed to clear that amount.');
    } finally {
      setClearing(false);
    }
  }

  if (loading && !data) return <Loading label="Loading punctuality…" />;
  if (error && !data) return <ErrorBox message={error} />;
  if (!data) return null;

  const starts = listedShiftStarts(data.shift_starts, data.shift_start);
  const canRemove = canRemoveShiftStart(starts.length);
  const openTone = punctualityTone(data.open_minutes);
  const dayStarts = data.day_starts ?? [];
  const emptyDay = noShiftStartMessage(dayStarts.length);
  const typedHours = Number(clearHours);
  const typedMinutes = Number(clearMinutes);
  const canClear = canClearPunctuality(data.open_minutes) && note.trim().length > 0 && !clearing;
  const canClearTyped =
    canClearAmount(data.open_minutes, typedHours, typedMinutes) && note.trim().length > 0 && !clearing;
  const typedLabel = canClearAmount(data.open_minutes, typedHours, typedMinutes)
    ? formatSignedMinutes(signedClearAmount(data.open_minutes, typedHours, typedMinutes))
    : '';

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="label">Shift starts (Zambia time)</div>
            {starts.length === 0 ? (
              <p className="text-sm text-gray-500">No start saved. A scan counts only after one is saved.</p>
            ) : (
              <ul className="space-y-2">
                {starts.map((time) => {
                  const draft = replaceDrafts[time] ?? time;
                  return (
                    <li key={time} className="flex flex-wrap items-center gap-2">
                      <span className="w-14 font-medium tabular-nums text-gray-900">{time}</span>
                      <input
                        className="input w-36"
                        type="time"
                        aria-label={`Replace ${time}`}
                        value={draft}
                        onChange={(e) => setReplaceDrafts((current) => ({ ...current, [time]: e.target.value }))}
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={saving || clock(draft) === time}
                        onClick={() => replaceShift(time)}
                      >
                        Replace
                      </button>
                      {canRemove && (
                        <button type="button" className="btn-ghost" disabled={saving} onClick={() => removeShift(time)}>
                          Remove
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <form onSubmit={addShift} className="flex items-end gap-2">
              <Field label="Add a start" className="w-44">
                <input className="input" type="time" value={addDraft} onChange={(e) => setAddDraft(e.target.value)} required />
              </Field>
              <button type="submit" className="btn-primary" disabled={saving || !addDraft.trim()}>
                {saving ? 'Saving…' : 'Add'}
              </button>
            </form>
          </div>
          <div className="text-right">
            <div className="label">Open aggregate</div>
            <div className={`text-2xl font-bold tabular-nums ${punctualityClass(openTone)}`}>
              {formatSignedMinutes(data.open_minutes)}
            </div>
          </div>
        </div>

        <div>
          <div className="label">This day</div>
          {emptyDay ? (
            <p className="mt-1 text-sm text-gray-500">{emptyDay}</p>
          ) : (
            <ul className="mt-1 space-y-2">
              {dayStarts.map((row) => {
                const tone = row.scored ? punctualityTone(row.signed_minutes) : 'neutral';
                return (
                  <li key={row.shift_start} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium tabular-nums text-gray-900">{presenceRowStart(row)}</span>
                    <span className={`text-lg font-bold tabular-nums ${punctualityClass(tone)}`}>
                      {dayStartLabel(row)}
                    </span>
                    {row.scored && (
                      <span className="text-gray-500">
                        scanned {row.first_scan} against {row.shift_start}
                      </span>
                    )}
                    {row.settled && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Settled</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <form onSubmit={clearTypedAmount} className="space-y-2 border-t border-gray-100 pt-4">
          <Field label="Clear note">
            <input
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this time is being settled"
            />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Hours" className="w-24">
              <input
                className="input"
                type="number"
                min={0}
                step={1}
                value={clearHours}
                onChange={(e) => setClearHours(e.target.value)}
                aria-label="Hours to clear"
              />
            </Field>
            <Field label="Minutes" className="w-24">
              <input
                className="input"
                type="number"
                min={0}
                max={59}
                step={1}
                value={clearMinutes}
                onChange={(e) => setClearMinutes(e.target.value)}
                aria-label="Minutes to clear"
              />
            </Field>
            <button type="submit" className="btn-ghost" disabled={!canClearTyped}>
              {clearing ? 'Clearing…' : typedLabel ? `Clear ${typedLabel}` : 'Clear amount'}
            </button>
            <button type="button" className="btn-ghost" disabled={!canClear} onClick={() => void clearAggregate()}>
              {clearing ? 'Clearing…' : `Clear ${formatSignedMinutes(data.open_minutes)}`}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            Clearing a smaller amount leaves the rest open. Clearing the whole total marks the days settled. Neither moves money.
          </p>
        </form>

        {actionError && <ErrorBox message={actionError} />}

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Settlements</h3>
          {data.settlements?.length ? null : <p className="mt-2 text-sm text-gray-500">No clears yet.</p>}
          {(data.settlements ?? []).length > 0 && (
            <ul className="mt-2 divide-y divide-gray-100 text-sm">
              {(data.settlements ?? []).map((settlement) => {
                const tone = punctualityTone(settlement.total);
                return (
                  <li key={`${settlement.at}-${settlement.note}`} className="flex items-start justify-between gap-3 py-2">
                    <div>
                      <div className="text-gray-800">{settlement.note}</div>
                      <div className="text-xs text-gray-400">
                        {settlement.admin || 'admin'} · {formatDate(settlement.at)}
                      </div>
                    </div>
                    <span className={`font-semibold tabular-nums ${punctualityClass(tone)}`}>
                      {formatSignedMinutes(settlement.total)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
