'use client';

import { create } from 'zustand';
import type { DisputeStatus } from './types';

interface DisputeState {
  openCount: number | null;
  setOpenCount: (n: number) => void;
}

export const useDisputes = create<DisputeState>((set) => ({
  openCount: null,
  setOpenCount: (n) => set({ openCount: n })
}));

export const DISPUTE_STATUS_TONE: Record<DisputeStatus, 'red' | 'amber' | 'green' | 'gray'> = {
  OPEN: 'red',
  UNDER_REVIEW: 'amber',
  RESOLVED: 'green',
  REJECTED: 'gray'
};

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under review',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected'
};

/** Matches models.UnknownStoreID in qcom — disputes whose store could not be resolved. */
export const UNKNOWN_STORE_ID = 'UNKNOWN';
