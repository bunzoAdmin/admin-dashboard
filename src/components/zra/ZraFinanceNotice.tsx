'use client';

import type { ZraFinanceAccessState } from '@/lib/useZraFinanceAccess';

type Props = {
  access: ZraFinanceAccessState;
  className?: string;
};

export function ZraFinanceNotice({ access, className = '' }: Props) {
  if (access.loading || access.allowed || !access.username) return null;

  return (
    <p className={`text-xs text-amber-700 ${className}`.trim()}>
      User <span className="font-mono">{access.username}</span> is not authorized for ZRA finance
      actions. Ask ops to add your username to{' '}
      <span className="font-mono">ZRA_FINANCE_ADMIN_USERS</span> on order-service (and mirror it in{' '}
      <span className="font-mono">NEXT_PUBLIC_ZRA_FINANCE_ADMIN_USERS</span> for the dashboard UI).
    </p>
  );
}
