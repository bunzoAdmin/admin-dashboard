export interface CountryOption {
  code: 'ZM' | 'IN';
  dial: '+260' | '+91';
  label: string;
  placeholder: string;
}

export const COUNTRY_CODES: CountryOption[] = [
  { code: 'ZM', dial: '+260', label: 'Zambia (+260)', placeholder: '971234567' },
  { code: 'IN', dial: '+91', label: 'India (+91)', placeholder: '9876543210' }
];

export const DEFAULT_COUNTRY_DIAL = '+260';

export function sanitizeLocalNumber(raw: string): string {
  return raw.replace(/\D/g, '');
}

export function buildPhoneNumber(dialCode: string, localNumber: string): string {
  const digits = sanitizeLocalNumber(localNumber);
  if (!digits) return '';
  return `${dialCode}${digits}`;
}
