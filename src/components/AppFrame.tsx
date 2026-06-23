'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import clsx from 'clsx';
import { Users, UserPlus, PackageCheck, SlidersHorizontal, UserCog, QrCode, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { ToastProvider, Spinner } from './ui';

const NAV = [
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/onboarding', label: 'Onboard Driver', icon: UserPlus },
  { href: '/assign', label: 'Assign Order', icon: PackageCheck },
  { href: '/store-qr', label: 'Store QR', icon: QrCode },
  { href: '/rules', label: 'Payout Rules', icon: SlidersHorizontal },
  { href: '/users', label: 'Admin Users', icon: UserCog }
];

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, hydrated, hydrate, logout } = useAuth();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (hydrated && !token && !isLogin) {
      router.replace('/login');
    }
  }, [hydrated, token, isLogin, router]);

  if (isLogin) {
    return <ToastProvider>{children}</ToastProvider>;
  }

  if (!hydrated || !token) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen">
        <aside className="flex w-60 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="flex items-center gap-2 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-gray-900">Bunzo Admin</div>
              <div className="text-xs text-gray-400">Driver Ops</div>
            </div>
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    active ? 'bg-brand-green-light text-brand-green-dark' : 'text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-gray-200 p-3">
            <div className="px-2 pb-2 text-xs text-gray-400">
              Signed in as <span className="font-medium text-gray-600">{user?.name || user?.username || 'admin'}</span>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
        </main>
      </div>
    </ToastProvider>
  );
}
