'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './store';
import { isZraFinanceAdmin } from './zraFinance';
import { zraApi, ZraApiError } from './zraApi';

export type ZraFinanceAccessState = {
  loading: boolean;
  allowed: boolean;
  username: string | null;
  error: string | null;
};

/**
 * Resolves ZRA finance permissions from order-service (source of truth).
 * Falls back to client env mirror when the access check cannot be reached.
 */
export function useZraFinanceAccess(): ZraFinanceAccessState {
  const user = useAuth((s) => s.user);
  const username = user?.username?.trim() ?? null;
  const [state, setState] = useState<ZraFinanceAccessState>({
    loading: Boolean(username),
    allowed: false,
    username,
    error: null
  });

  useEffect(() => {
    if (!username) {
      setState({ loading: false, allowed: false, username: null, error: null });
      return;
    }

    let cancelled = false;
    setState((s) => ({ ...s, loading: true, username, error: null }));

    zraApi
      .checkFinanceAccess(username)
      .then((res) => {
        if (cancelled) return;
        setState({
          loading: false,
          allowed: Boolean(res.financeAdmin),
          username,
          error: null
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({
          loading: false,
          allowed: isZraFinanceAdmin(user),
          username,
          error: err instanceof ZraApiError ? err.message : null
        });
      });

    return () => {
      cancelled = true;
    };
  }, [username, user]);

  return state;
}
