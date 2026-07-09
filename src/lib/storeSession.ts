'use client';

const STORAGE_KEY = 'bunzo_admin_store_id';

export function readStoreId(): number | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function writeStoreId(storeId: number): void {
  sessionStorage.setItem(STORAGE_KEY, String(storeId));
}
