/** Shared helpers for inventory microservice API clients (browser → /api/v1/* proxies). */

export async function parseResponseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Extract a human-readable message from backend error payloads.
 * Handles order/product `{ error }`, validation `{ errors }`, and `{ message }`.
 */
export function inventoryApiErrorMessage(data: unknown, status: number, fallback?: string): string {
  if (typeof data === 'string' && data.trim()) {
    return data.trim();
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.error === 'string' && obj.error) {
      return obj.error;
    }
    if (typeof obj.message === 'string' && obj.message) {
      return obj.message;
    }
    if (obj.errors && typeof obj.errors === 'object' && !Array.isArray(obj.errors)) {
      const parts = Object.entries(obj.errors as Record<string, string>).map(
        ([field, msg]) => (field ? `${field}: ${msg}` : msg)
      );
      if (parts.length) return parts.join('; ');
    }
    if (obj.error && typeof obj.error === 'object') {
      const nested = obj.error as { message?: string };
      if (nested.message) return nested.message;
    }
  }
  return fallback ?? `Request failed (${status}).`;
}
