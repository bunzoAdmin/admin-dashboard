'use client';

import { useEffect, useState } from 'react';
import { zraApi, type ZraStandardCode } from '@/lib/zraApi';
import { Field } from '@/components/ui';

/** ZRA standard-code class for credit-note refund reasons (`rfdRsnCd`). */
export const CREDIT_REASON_CLASS = '32';
/** ZRA standard-code class for debit-note reasons (`dbtRsnCd`). */
export const DEBIT_REASON_CLASS = '67';

function reasonText(code: ZraStandardCode | undefined): string {
  return (code?.cdNm || code?.cdDesc || code?.cd || '').trim();
}

function asksForBrief(code: ZraStandardCode | undefined): boolean {
  return /^\s*other\b/i.test(reasonText(code));
}

interface ZraReasonCodeFieldProps {
  cdCls: string;
  value: string;
  onChange: (code: string, name: string) => void;
  disabled?: boolean;
}

export function ZraReasonCodeField({ cdCls, value, onChange, disabled }: ZraReasonCodeFieldProps) {
  const [codes, setCodes] = useState<ZraStandardCode[]>([]);
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const selected = codes.find((c) => c.cd === value);
  const other = asksForBrief(selected);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    zraApi
      .listStandardCodes({ cdCls, size: 200 })
      .then((rows) => {
        if (cancelled) return;
        const usable = (Array.isArray(rows) ? rows : [])
          .filter((c) => c.cd && (!c.useYn || c.useYn.toUpperCase() === 'Y'))
          .sort((a, b) => (a.cd ?? '').localeCompare(b.cd ?? ''));
        setCodes(usable);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load ZRA reason codes.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cdCls]);

  return (
    <Field label="Reason">
      <select
        className="input"
        value={value}
        disabled={disabled || loading || codes.length === 0}
        required
        onChange={(e) => {
          const code = e.target.value;
          const picked = codes.find((c) => c.cd === code);
          setBrief('');
          onChange(code, asksForBrief(picked) ? '' : reasonText(picked));
        }}
      >
        <option value="">{loading ? 'Loading reasons…' : 'Select a ZRA reason'}</option>
        {codes.map((c) => (
          <option key={c.cd} value={c.cd}>
            {c.cd} — {reasonText(c)}
          </option>
        ))}
      </select>
      {other && (
        <input
          className="input mt-2"
          value={brief}
          maxLength={200}
          placeholder="Other reason"
          disabled={disabled}
          onChange={(e) => {
            setBrief(e.target.value);
            onChange(value, e.target.value);
          }}
        />
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {!loading && !error && codes.length === 0 && (
        <p className="mt-1 text-xs text-amber-700">No reason codes synced for this note type.</p>
      )}
    </Field>
  );
}
