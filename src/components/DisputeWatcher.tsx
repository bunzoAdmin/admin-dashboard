'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { useDisputes } from '@/lib/disputes';
import { useToast } from './ui';

const POLL_MS = 15000;

export function DisputeWatcher() {
  const token = useAuth((s) => s.token);
  const setOpenCount = useDisputes((s) => s.setOpenCount);
  const { push } = useToast();
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    // Re-establish the baseline for each authenticated session so a re-login
    // (without a full page reload) doesn't toast against the prior session's count.
    prev.current = null;

    async function poll() {
      if (typeof document !== 'undefined' && document.hidden) return;
      try {
        const summary = await api.getDisputeSummary();
        if (!active) return;
        setOpenCount(summary.open);
        if (prev.current !== null && summary.open > prev.current) {
          const delta = summary.open - prev.current;
          push('info', `${delta} new dispute${delta > 1 ? 's' : ''} reported`);
        }
        prev.current = summary.open;
      } catch {
        // transient error; the next tick retries
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, setOpenCount, push]);

  return null;
}
