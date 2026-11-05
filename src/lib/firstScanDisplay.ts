/** Zambia-local first store-QR time, or the Presence-tab empty label. */
export function formatFirstScan(firstScanAt: string | null | undefined): string {
  const value = firstScanAt?.trim();
  return value ? value : 'Not scanned';
}
