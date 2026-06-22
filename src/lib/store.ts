'use client';

import { create } from 'zustand';

const STORAGE_KEY = 'bunzo_admin_key';
const LABEL_KEY = 'bunzo_admin_label';

interface AuthState {
  adminKey: string | null;
  adminLabel: string;
  hydrated: boolean;
  hydrate: () => void;
  login: (key: string, label: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  adminKey: null,
  adminLabel: '',
  hydrated: false,
  hydrate: () => {
    if (typeof window === 'undefined') return;
    set({
      adminKey: window.localStorage.getItem(STORAGE_KEY),
      adminLabel: window.localStorage.getItem(LABEL_KEY) ?? '',
      hydrated: true
    });
  },
  login: (key, label) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, key);
      window.localStorage.setItem(LABEL_KEY, label);
    }
    set({ adminKey: key, adminLabel: label });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    set({ adminKey: null });
  }
}));

export function getStoredAdminKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function getStoredAdminLabel(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(LABEL_KEY) ?? '';
}
