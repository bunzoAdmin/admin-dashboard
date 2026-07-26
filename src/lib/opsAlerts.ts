'use client';

import { create } from 'zustand';

interface OpsAlertsState {
  attentionCount: number | null;
  abandonedReconcileCount: number | null;
  setAttentionCount: (n: number) => void;
  setAbandonedReconcileCount: (n: number) => void;
}

export const useOpsAlerts = create<OpsAlertsState>((set) => ({
  attentionCount: null,
  abandonedReconcileCount: null,
  setAttentionCount: (n) => set({ attentionCount: n }),
  setAbandonedReconcileCount: (n) => set({ abandonedReconcileCount: n })
}));
