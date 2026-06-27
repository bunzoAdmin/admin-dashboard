'use client';

const STORAGE_KEY = 'bunzo_admin_store_id';

export function defaultStoreId(): number {
  const fromEnv = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID;
  const parsed = fromEnv ? parseInt(fromEnv, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : 1;
}

export function readStoreId(): number {
  if (typeof window === 'undefined') return defaultStoreId();
  const raw = sessionStorage.getItem(STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : defaultStoreId();
}

export function writeStoreId(storeId: number): void {
  sessionStorage.setItem(STORAGE_KEY, String(storeId));
}
