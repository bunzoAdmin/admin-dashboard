'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import clsx from 'clsx';
import { ChevronDown, LogOut, Menu, Search, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '@/lib/store';
import { useDisputes } from '@/lib/disputes';
import { useOpsAlerts } from '@/lib/opsAlerts';
import { filterNavSections, isNavItemActive, isSectionActive, NAV_SECTIONS, type NavSection } from '@/lib/navConfig';
import { ToastProvider, Spinner } from './ui';
import { DisputeWatcher } from './DisputeWatcher';
import { OpsWatcher } from './OpsWatcher';
import { PickNotStartedBanner } from './PickNotStartedBanner';
import { Breadcrumbs } from './Breadcrumbs';

const SIDEBAR_WIDTH_KEY = 'bunzo-sidebar-width';
const MIN_WIDTH = 56;
const MAX_WIDTH = 360;
const ICON_ONLY_THRESHOLD = 100;
const DEFAULT_WIDTH = 240;

type SidebarNavProps = {
  pathname: string;
  iconOnly?: boolean;
  sectionExpanded: Record<string, boolean>;
  onToggleSection: (id: string) => void;
  openCount: number | null;
  attentionCount: number | null;
  abandonedReconcileCount: number | null;
  navRef: RefObject<HTMLElement | null>;
  userLabel: string;
  onLogout: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
};

function NavSearchField({
  value,
  onChange,
  autoFocus,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search pages…"
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-gray-700 bg-gray-900/60 py-2 pl-8 pr-8 text-sm text-gray-100 placeholder:text-gray-500 focus:border-brand-green/40 focus:outline-none focus:ring-1 focus:ring-brand-green/30"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:text-gray-300"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function NavItemLink({
  pathname,
  href,
  label,
  icon: Icon,
  disputeBadge,
  attentionBadge,
  reconcileBadge,
  exact,
  openCount,
  attentionCount,
  abandonedReconcileCount,
  sectionLabel,
  onNavigate
}: {
  pathname: string;
  href: string;
  label: string;
  icon: NavSection['items'][0]['icon'];
  disputeBadge?: boolean;
  attentionBadge?: boolean;
  reconcileBadge?: boolean;
  exact?: boolean;
  openCount: number | null;
  attentionCount: number | null;
  abandonedReconcileCount: number | null;
  sectionLabel?: string;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(pathname, href, exact);
  const badgeCount = disputeBadge
    ? openCount
    : attentionBadge
      ? attentionCount
      : reconcileBadge
        ? abandonedReconcileCount
        : null;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-nav-active={active ? 'true' : undefined}
      className={clsx(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
        active ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {sectionLabel && <span className="block truncate text-[10px] font-normal uppercase tracking-wide text-gray-600">{sectionLabel}</span>}
      </span>
      {badgeCount != null && badgeCount > 0 && (
        <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
          {badgeCount > 99 ? '99+' : badgeCount}
        </span>
      )}
    </Link>
  );
}

/** Defined at module scope so navigation does not remount the sidebar and reset scroll. */
function SidebarNav({
  pathname,
  iconOnly = false,
  sectionExpanded,
  onToggleSection,
  openCount,
  attentionCount,
  abandonedReconcileCount,
  navRef,
  userLabel,
  onLogout,
  searchQuery,
  onSearchChange
}: SidebarNavProps) {
  const [iconSearchOpen, setIconSearchOpen] = useState(false);
  const visibleSections = useMemo(() => filterNavSections(searchQuery), [searchQuery]);
  const isFiltering = searchQuery.trim().length > 0;

  const clearSearch = useCallback(() => {
    onSearchChange('');
    setIconSearchOpen(false);
  }, [onSearchChange]);

  return (
    <>
      <div className={clsx('flex shrink-0 items-center gap-2 py-5', iconOnly ? 'justify-center px-0' : 'px-5')}>
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

      {iconOnly ? (
        <div className="relative shrink-0 px-1 pb-2">
          <button
            type="button"
            title="Search pages"
            onClick={() => setIconSearchOpen((v) => !v)}
            className={clsx(
              'mx-auto flex items-center justify-center rounded-lg p-2.5 transition',
              iconSearchOpen || isFiltering ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
            )}
          >
            <Search className="h-4 w-4" />
          </button>
          {iconSearchOpen && (
            <div className="absolute left-full top-0 z-50 ml-2 w-72 rounded-xl border border-gray-700 bg-brand-dark p-3 shadow-2xl">
              <NavSearchField value={searchQuery} onChange={onSearchChange} autoFocus />
              <div className="mt-2 max-h-80 space-y-0.5 overflow-y-auto">
                {visibleSections.flatMap((section) =>
                  section.items.map((item) => (
                    <NavItemLink
                      key={item.href}
                      pathname={pathname}
                      {...item}
                      openCount={openCount}
                      attentionCount={attentionCount}
                      abandonedReconcileCount={abandonedReconcileCount}
                      sectionLabel={section.label || undefined}
                      onNavigate={clearSearch}
                    />
                  ))
                )}
                {isFiltering && visibleSections.flatMap((s) => s.items).length === 0 && (
                  <p className="py-4 text-center text-sm text-gray-500">No matches</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="shrink-0 px-2 pb-2">
          <NavSearchField value={searchQuery} onChange={onSearchChange} />
        </div>
      )}

      <nav ref={navRef} className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3">
        {iconOnly ? (
          <div className="space-y-0.5">
            {NAV_SECTIONS.flatMap((section) =>
              section.items.map(({ href, label, icon: Icon, disputeBadge, attentionBadge, reconcileBadge, exact }) => {
                const active = isNavItemActive(pathname, href, exact);
                const badgeCount = disputeBadge
                  ? openCount
                  : attentionBadge
                    ? attentionCount
                    : reconcileBadge
                      ? abandonedReconcileCount
                      : null;
                return (
                  <Link
                    key={href}
                    href={href}
                    title={label}
                    data-nav-active={active ? 'true' : undefined}
                    className={clsx(
                      'flex items-center justify-center rounded-lg p-2.5 transition',
                      active ? 'bg-brand-green/15 text-brand-green' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                    )}
                  >
                    <div className="relative">
                      <Icon className="h-4 w-4" />
                      {badgeCount != null && badgeCount > 0 && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                          {badgeCount > 9 ? '9+' : badgeCount}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isFiltering && visibleSections.length === 0 && (
              <p className="px-3 py-8 text-center text-sm text-gray-500">
                No pages match &ldquo;{searchQuery.trim()}&rdquo;
              </p>
            )}
            {visibleSections.map((section) => {
              const isHomeOnly = !section.label;
              const isOpen = isFiltering || isHomeOnly || sectionExpanded[section.id] !== false;
              return (
                <div key={section.id}>
                  {section.label && (
                    <button
                      type="button"
                      onClick={() => !isFiltering && onToggleSection(section.id)}
                      className={clsx(
                        'mb-1 flex w-full items-center justify-between rounded-md px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500',
                        isFiltering ? 'cursor-default' : 'hover:text-gray-300'
                      )}
                    >
                      <span className="truncate">{section.label}</span>
                      {!isFiltering && (
                        <ChevronDown className={clsx('ml-1 h-3.5 w-3.5 shrink-0 transition', isOpen ? 'rotate-0' : '-rotate-90')} />
                      )}
                    </button>
                  )}
                  {isOpen && (
                    <div className="space-y-0.5">
                      {section.items.map((item) => (
                        <NavItemLink
                          key={item.href}
                          pathname={pathname}
                          {...item}
                          openCount={openCount}
                          attentionCount={attentionCount}
                          abandonedReconcileCount={abandonedReconcileCount}
                          onNavigate={clearSearch}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-gray-800 p-2">
        {!iconOnly && (
          <div className="px-2 pb-2 text-xs text-gray-500">
            Signed in as <span className="font-medium text-gray-300">{userLabel}</span>
          </div>
        )}
        <button
          onClick={onLogout}
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

function scrollActiveNavItemIntoView(...navRefs: Array<RefObject<HTMLElement | null>>) {
  requestAnimationFrame(() => {
    for (const navRef of navRefs) {
      const nav = navRef.current;
      if (!nav) continue;
      const active = nav.querySelector('[data-nav-active="true"]');
      if (active instanceof HTMLElement) {
        active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        break;
      }
    }
  });
}

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token, user, hydrated, hydrate, logout } = useAuth();
  const openCount = useDisputes((s) => s.openCount);
  const attentionCount = useOpsAlerts((s) => s.attentionCount);
  const abandonedReconcileCount = useOpsAlerts((s) => s.abandonedReconcileCount);

  const [sectionExpanded, setSectionExpanded] = useState<Record<string, boolean>>({});
  const [mobileOpen, setMobileOpen] = useState(false);
  const [navSearch, setNavSearch] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [widthReady, setWidthReady] = useState(false);

  const desktopNavRef = useRef<HTMLElement>(null);
  const mobileNavRef = useRef<HTMLElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const isDragging = useRef(false);

  const userLabel = user?.name || user?.username || 'admin';

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

  function persistWidth(w: number) {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(w));
    } catch {}
  }

  function handleDragStart(e: React.MouseEvent) {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
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
      setSidebarWidth((w) => {
        persistWidth(w);
        return w;
      });
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

  useEffect(() => {
    setMobileOpen(false);
    setNavSearch('');
  }, [pathname]);

  useEffect(() => {
    if (pathname === '/login') return;
    scrollActiveNavItemIntoView(desktopNavRef, mobileNavRef);
  }, [pathname, sectionExpanded, mobileOpen]);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (hydrated && !token && !isLogin) router.replace('/login');
  }, [hydrated, token, isLogin, router]);

  const toggleSection = useCallback((id: string) => {
    setSectionExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleLogout = useCallback(() => {
    logout();
    router.replace('/login');
  }, [logout, router]);

  if (isLogin) return <ToastProvider>{children}</ToastProvider>;

  if (!hydrated || !token) {
    return (
      <div className="flex h-screen items-center justify-center text-gray-400">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const isIconOnly = widthReady && sidebarWidth < ICON_ONLY_THRESHOLD;

  const sidebarProps = {
    pathname,
    sectionExpanded,
    onToggleSection: toggleSection,
    openCount,
    attentionCount,
    abandonedReconcileCount,
    userLabel,
    onLogout: handleLogout,
    searchQuery: navSearch,
    onSearchChange: setNavSearch
  };

  const navBadgeTotal =
    (openCount ?? 0) + (attentionCount ?? 0) + (abandonedReconcileCount ?? 0);

  return (
    <ToastProvider>
      <DisputeWatcher />
      <OpsWatcher />
      <div className="flex h-screen overflow-hidden">
        <aside
          className="relative hidden h-full shrink-0 flex-col border-r border-gray-800 bg-brand-dark text-gray-300 md:flex"
          style={{ width: widthReady ? sidebarWidth : DEFAULT_WIDTH }}
        >
          <SidebarNav {...sidebarProps} iconOnly={isIconOnly} navRef={desktopNavRef} />
          <div
            onMouseDown={handleDragStart}
            className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize transition-colors hover:bg-brand-green/40 active:bg-brand-green/60"
            title="Drag to resize"
          />
        </aside>

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
              <SidebarNav {...sidebarProps} navRef={mobileNavRef} />
            </aside>
          </div>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
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
            {navBadgeTotal > 0 && (
              <span className="ml-auto inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                {navBadgeTotal > 99 ? '99+' : navBadgeTotal}
              </span>
            )}
          </header>

          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 md:px-8 md:py-8">
              <PickNotStartedBanner />
              <Breadcrumbs />
              {children}
            </div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
