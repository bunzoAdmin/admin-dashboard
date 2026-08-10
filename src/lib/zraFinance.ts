import type { AdminUser } from './types';

/**
 * Client-side gate for ZRA finance actions.
 * Mirror of backend `zra.finance-admin-users` / `ZRA_FINANCE_ADMIN_USERS`.
 *
 * - If `NEXT_PUBLIC_ZRA_FINANCE_ADMIN_USERS` is set → username must be listed.
 * - If empty and `NEXT_PUBLIC_ZRA_FINANCE_ADMIN_REQUIRED=true` → deny all (prod-safe).
 * - If empty and required is not true → any logged-in admin (local/dev).
 */
export function isZraFinanceAdmin(user: AdminUser | null | undefined): boolean {
  if (!user?.username) return false;
  const raw = process.env.NEXT_PUBLIC_ZRA_FINANCE_ADMIN_USERS ?? '';
  const allowed = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) {
    const required = (process.env.NEXT_PUBLIC_ZRA_FINANCE_ADMIN_REQUIRED ?? '').toLowerCase();
    if (required === 'true' || required === '1') return false;
    return true;
  }
  return allowed.includes(user.username.trim().toLowerCase());
}
