'use client';

import clsx from 'clsx';
import { COUNTRY_CODES, sanitizeLocalNumber } from '@/lib/phone';

interface PhoneInputProps {
  countryCode: string;
  localNumber: string;
  onCountryCodeChange: (dial: string) => void;
  onLocalNumberChange: (local: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function PhoneInput({
  countryCode,
  localNumber,
  onCountryCodeChange,
  onLocalNumberChange,
  autoFocus,
  disabled,
  id,
  className
}: PhoneInputProps) {
  const selected = COUNTRY_CODES.find((c) => c.dial === countryCode) ?? COUNTRY_CODES[0];

  return (
    <div className={clsx('flex gap-2', className)}>
      <select
        className="input w-[10.5rem] shrink-0"
        value={countryCode}
        onChange={(e) => onCountryCodeChange(e.target.value)}
        disabled={disabled}
        aria-label="Country code"
      >
        {COUNTRY_CODES.map((c) => (
          <option key={c.code} value={c.dial}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        id={id}
        className="input min-w-0 flex-1"
        value={localNumber}
        onChange={(e) => onLocalNumberChange(sanitizeLocalNumber(e.target.value))}
        placeholder={selected.placeholder}
        inputMode="numeric"
        autoComplete="tel-national"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label="Phone number"
      />
    </div>
  );
}
