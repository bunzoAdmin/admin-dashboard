'use client';

import { create } from 'zustand';

interface OpsAlertsState {
  attentionCount: number | null;
  /** CONFIRMED with no pick started: orphan, pending task, or acceptance timeout. */
  unstartedPickCount: number | null;
  abandonedReconcileCount: number | null;
  setAttentionCount: (n: number) => void;
  setUnstartedPickCount: (n: number) => void;
  setAbandonedReconcileCount: (n: number) => void;
}

export const UNSTARTED_PICK_KINDS = new Set(['ORPHAN_ORDER', 'PENDING_TASK', 'ACCEPTANCE_TIMEOUT']);

export const useOpsAlerts = create<OpsAlertsState>((set) => ({
  attentionCount: null,
  unstartedPickCount: null,
  abandonedReconcileCount: null,
  setAttentionCount: (n) => set({ attentionCount: n }),
  setUnstartedPickCount: (n) => set({ unstartedPickCount: n }),
  setAbandonedReconcileCount: (n) => set({ abandonedReconcileCount: n })
}));
