'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useOpsAlerts } from '@/lib/opsAlerts';
import { disposePickNotStartedAlarm, syncPickNotStartedAlarm } from '@/lib/pickNotStartedAlarm';

export function PickNotStartedBanner() {
  const count = useOpsAlerts((s) => s.unstartedPickCount);

  useEffect(() => {
    syncPickNotStartedAlarm(count);
  }, [count]);

  useEffect(() => () => disposePickNotStartedAlarm(), []);

  if (!count || count <= 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pick-alarm-bar sticky top-0 z-50 -mx-4 mb-4 border-b-4 border-yellow-300 px-4 py-3 text-white sm:-mx-6 sm:px-6 md:-mx-8 md:px-8"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
          <span className="pick-alarm-ring absolute inset-0 rounded-full border-2 border-yellow-200" />
          <AlertTriangle className="pick-alarm-shake-fast relative h-6 w-6 text-yellow-200" />
        </span>

        <div className="pick-alarm-shake min-w-0 flex-1">
          <p className="text-base font-black uppercase tracking-wide text-yellow-100">
            Pick not started — {count} order{count === 1 ? '' : 's'} waiting
          </p>
          <p className="text-xs font-semibold text-red-100/95">
            Confirmed orders with no picker activity. Assign manually or check devices now.
          </p>
        </div>

        <Link
          href="/pickers/attention"
          className="rounded-md bg-yellow-300 px-4 py-2 text-xs font-black uppercase tracking-wide text-red-900 shadow-lg hover:bg-yellow-200"
        >
          Fix now
        </Link>
      </div>
    </div>
  );
}
