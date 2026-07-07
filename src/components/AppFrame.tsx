'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { ChevronDown, LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { useDisputes } from '@/lib/disputes';
import { isNavItemActive, isSectionActive, NAV_SECTIONS } from '@/lib/navConfig';
import { ToastProvider, Spinner } from './ui';
import { DisputeWatcher } from './DisputeWatcher';
import { Breadcrumbs } from './Breadcrumbs';

const SIDEBAR_WIDTH_KEY = 'bunzo-sidebar-width';
const MIN_WIDTH = 56;
const MAX_WIDTH = 360;
// below this px threshold the sidebar renders in icon-only mode
const ICON_ONLY_THRESHOLD = 100;
const DEFAULT_WIDTH = 240;

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, hydrated, hydrate, logout } = useAuth();
  const openCount = useDisputes((s) => s.openCount);

  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sidebar width state — start at default, fix after localStorage hydration
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [widthReady, setWidthReady] = useState(false);

  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const isDragging = useRef(false);

  // Load persisted width
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
      if (saved) {
        const n = Number(saved);
        if (!isNaN(n)) setSidebarWidth(Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n)));
      }
    } catch {}
    setWidthReady(true);
  }, []);

  // Persist width after drag ends (called inside mouseup)
  function persistWidth(w: number) {
    try { localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w)); } catch {}
  }

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;

    // Keep ew-resize cursor during the whole drag
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    function onMouseMove(ev: MouseEvent) {
      if (!isDragging.current) return;
      const delta = ev.clientX - dragStartX.current;
      const next = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, dragStartWidth.current + delta));
      setSidebarWidth(next);
    }

    function onMouseUp() {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setSidebarWidth((w) => { persistWidth(w); return w; });
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    setSectionExpanded((prev) => {
      const next = { ...prev };
      for (const section of NAV_SECTIONS) {
        if (section.label && isSectionActive(pathname, section)) {
          next[section.id] = true;
        }
      }
      return next;
    });
  }, [pathname]);

  // Close mobile drawer on navigate
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (hydrated && !token && !isLogin) router.replace('/login');
  }, [hydrated, token, isLogin, router]);

  if (isLogin) return <ToastProvider>{children}</ToastProvider>;

  if (!hydrated || !token) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  function toggleSection(id: string) {
    setSectionExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const isIconOnly = widthReady && sidebarWidth < ICON_ONLY_THRESHOLD;

  // The actual nav content, reused in both desktop sidebar and mobile drawer
  function SidebarInner({ iconOnly = false }: { iconOnly?: boolean }) {
    return (
      <>
        {/* Header */}
        <div className={clsx('flex items-center gap-2 py-5 shrink-0', iconOnly ? 'justify-center px-0' : 'px-5')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-green text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!iconOnly && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight text-white">Bunzo Admin</div>
              <div className="truncate text-xs text-gray-500">Operations Console</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
          {iconOnly ? (
            // Flat icon-only list
            <div className="space-y-0.5">
              {NAV_SECTIONS.flatMap((section) =>
                section.items.map(({ href, label, icon: Icon, disputeBadge, exact }) => {
                  const active = isNavItemActive(pathname, href, exact);
                  return (
                    <Link
                      key={href}
                      href={href}
                      title={label}
                      className={clsx(
                        'flex items-center justify-center rounded-lg p-2.5 transition',
                        active ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                      )}
                    >
                      <div className="relative">
                        <Icon className="h-4 w-4" />
                        {disputeBadge && openCount != null && openCount > 0 && (
                          <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                            {openCount > 9 ? '9+' : openCount}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          ) : (
            // Full label list with collapsible sections
            <div className="space-y-3">
              {NAV_SECTIONS.map((section) => {
                const isHomeOnly = !section.label;
                const isOpen = isHomeOnly || sectionExpanded[section.id] !== false;
                return (
                  <div key={section.id}>
                    {section.label && (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.id)}
                        className="mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-300"
                      >
                        <span className="truncate">{section.label}</span>
                        <ChevronDown className={clsx('ml-1 h-3.5 w-3.5 shrink-0 transition', isOpen ? 'rotate-0' : '-rotate-90')} />
                      </button>
                    )}
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
                                active ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                              )}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span className="flex-1 truncate">{label}</span>
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
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-800 p-2">
          {!iconOnly && (
            <div className="px-2 pb-2 text-xs text-gray-500">
              Signed in as{' '}
              <span className="font-medium text-gray-300">{user?.name || user?.username || 'admin'}</span>
            </div>
          )}
          <button
            onClick={() => { logout(); router.replace('/login'); }}
            title="Sign out"
            className={clsx(
              'flex w-full items-center rounded-lg py-2 text-sm font-medium text-gray-400 transition hover:bg-white/5 hover:text-gray-200',
              iconOnly ? 'justify-center' : 'gap-3 px-3'
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!iconOnly && <span>Sign out</span>}
          </button>
        </div>
      </>
    );
  }

  return (
    <ToastProvider>
      <DisputeWatcher />
      <div className="flex h-screen overflow-hidden">

        {/* ── Desktop sidebar (resizable) ── */}
        <aside
          className="relative hidden md:flex h-full shrink-0 flex-col border-r border-gray-800 bg-brand-dark text-gray-300"
          style={{ width: widthReady ? sidebarWidth : DEFAULT_WIDTH }}
        >
          <SidebarInner iconOnly={isIconOnly} />

          {/* Drag handle */}
          <div
            onMouseDown={handleDragStart}
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize transition-colors hover:bg-brand-green/40 active:bg-brand-green/60"
            title="Drag to resize"
          />
        </aside>

        {/* ── Mobile sidebar drawer ── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-gray-800 bg-brand-dark text-gray-300">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 rounded-md p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarInner />
            </aside>
          </div>
        )}

        {/* ── Main content ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile top bar */}
          <header className="flex items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 md:hidden">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-green text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <span className="text-sm font-bold text-gray-900">Bunzo Admin</span>
            </div>
            {openCount != null && openCount > 0 && (
              <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                {openCount > 99 ? '99+' : openCount}
              </span>
            )}
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:px-8 md:py-8">
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
