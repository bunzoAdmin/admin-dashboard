'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { useDisputes } from '@/lib/disputes';
import { isNavItemActive, isSectionActive, NAV_SECTIONS } from '@/lib/navConfig';
import { ToastProvider, Spinner } from './ui';
import { DisputeWatcher } from './DisputeWatcher';
import { Breadcrumbs } from './Breadcrumbs';

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, hydrated, hydrate, logout } = useAuth();
  const openCount = useDisputes((s) => s.openCount);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const section of NAV_SECTIONS) {
        if (section.label && isSectionActive(pathname, section)) {
          next[section.id] = true;
        }
      }
      return next;
    });
  }, [pathname]);

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

  function toggleSection(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <ToastProvider>
      <DisputeWatcher />
      <div className="flex h-screen overflow-hidden">
        <aside className="flex h-full w-60 shrink-0 flex-col border-r border-gray-800 bg-brand-dark text-gray-300">
          <div className="flex items-center gap-2 px-5 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-green text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight text-white">Bunzo Admin</div>
              <div className="text-xs text-gray-500">Operations Console</div>
            </div>
          </div>
          <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-3">
            {NAV_SECTIONS.map((section) => {
              const isHomeOnly = !section.label;
              const isOpen = isHomeOnly || expanded[section.id] !== false;

              return (
                <div key={section.id}>
                  {section.label ? (
                    <button
                      type="button"
                      onClick={() => toggleSection(section.id)}
                      className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-300"
                    >
                      {section.label}
                      <ChevronDown className={clsx('h-3.5 w-3.5 transition', isOpen ? 'rotate-0' : '-rotate-90')} />
                    </button>
                  ) : null}
                  {isOpen && (
                    <div className="space-y-0.5">
                      {section.items.map(({ href, label, icon: Icon, disputeBadge, exact }) => {
                        const active = isNavItemActive(pathname, href, exact);
                        return (
                          <Link
                            key={href}
                            href={href}
                            className={clsx(
                              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                              active
                                ? 'bg-brand-green/15 text-brand-green'
                                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="flex-1">{label}</span>
                            {disputeBadge && openCount != null && openCount > 0 && (
                              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                                {openCount > 99 ? '99+' : openCount}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="border-t border-gray-800 p-3">
            <div className="px-2 pb-2 text-xs text-gray-500">
              Signed in as <span className="font-medium text-gray-300">{user?.name || user?.username || 'admin'}</span>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-gray-200"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-6xl px-8 py-8">
            <Breadcrumbs />
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
