'use client';

import { create } from 'zustand';
import type { AdminUser } from './types';

export type { AdminUser };

const TOKEN_KEY = 'bunzo_admin_token';
const USER_KEY = 'bunzo_admin_user';

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  hydrated: boolean;
  hydrate: () => void;
  login: (token: string, user: AdminUser) => void;
  logout: () => void;
}

function readUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: () => {
    if (typeof window === 'undefined') return;
    set({
      token: window.localStorage.getItem(TOKEN_KEY),
      user: readUser(),
      hydrated: true
    });
  },
  login: (token, user) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TOKEN_KEY, token);
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    set({ token, user });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(USER_KEY);
    }
    set({ token: null, user: null });
  }
}));

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
