import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  FolderTree,
  Home,
  List,
  Medal,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  QrCode,
  ScanBarcode,
  SlidersHorizontal,
  UserCog,
  UserPlus,
  Users,
  ClipboardList,
  Clock,
  RefreshCw
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Only highlight on exact path match (not sub-routes). */
  exact?: boolean;
  /** Show open dispute count badge (Orders › Disputes). */
  disputeBadge?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'home',
    label: '',
    items: [{ href: '/', label: 'Home', icon: Home }]
  },
  {
    id: 'orders',
    label: 'Orders',
    items: [
      { href: '/orders/disputes', label: 'Disputes', icon: AlertTriangle, disputeBadge: true },
      { href: '/orders/assign', label: 'Assign Order', icon: PackageCheck }
    ]
  },
  {
    id: 'riders',
    label: 'Riders',
    items: [
      { href: '/riders', label: 'All Riders', icon: Users },
      { href: '/riders/onboard', label: 'Onboard Rider', icon: UserPlus },
      { href: '/riders/payout-rules', label: 'Payout Rules', icon: SlidersHorizontal }
    ]
  },
  {
    id: 'catalog',
    label: 'Catalog',
    items: [
      { href: '/catalog/categories', label: 'Categories', icon: FolderTree },
      { href: '/catalog/badges', label: 'Badges', icon: Medal },
      { href: '/catalog/products', label: 'Products', icon: ScanBarcode, exact: true },
      { href: '/catalog/products/browse', label: 'Browse', icon: Package }
    ]
  },
  {
    id: 'barcode-generator',
    label: 'Barcode Generator',
    items: [
      { href: '/barcode-generator/list', label: 'List of Barcodes', icon: List },
      { href: '/barcode-generator/generate', label: 'Generate New', icon: Plus }
    ]
  },
  {
    id: 'pickers',
    label: 'Pickers',
    items: [
      { href: '/pickers', label: 'Live Ops', icon: ClipboardList, exact: true },
      { href: '/pickers/onboard', label: 'Onboard', icon: UserPlus },
      { href: '/pickers/shifts', label: 'Shifts', icon: Clock },
      { href: '/pickers/reconcile', label: 'Reconciliation', icon: RefreshCw }
    ]
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [{ href: '/inventory', label: 'Inwarding', icon: PackagePlus, exact: true }]
  },
  {
    id: 'stores',
    label: 'Stores',
    items: [{ href: '/stores/qr', label: 'Store QR', icon: QrCode }]
  },
  {
    id: 'settings',
    label: 'Settings',
    items: [{ href: '/settings/users', label: 'Admin Users', icon: UserCog }]
  }
];

/** Flat list of all nav items for breadcrumbs lookup. */
export const ALL_NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function isNavItemActive(pathname: string, href: string, exact?: boolean): boolean {
  if (href === '/') return pathname === '/';
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + '/');
}

export function isSectionActive(pathname: string, section: NavSection): boolean {
  return section.items.some((item) => isNavItemActive(pathname, item.href, item.exact));
}

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

/** Build breadcrumb trail from pathname. */
export function breadcrumbsForPath(pathname: string): BreadcrumbSegment[] {
  const crumbs: BreadcrumbSegment[] = [{ label: 'Home', href: '/' }];

  if (pathname === '/') return [{ label: 'Home' }];

  const matched = ALL_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href, item.exact));
  if (matched) {
    const section = NAV_SECTIONS.find((s) => s.items.some((i) => i.href === matched.href));
    if (section?.label) crumbs.push({ label: section.label });
    if (pathname === matched.href) {
      crumbs.push({ label: matched.label });
    } else {
      crumbs.push({ label: matched.label, href: matched.href });
      crumbs.push({ label: detailLabel(pathname, matched.href) });
    }
    return crumbs;
  }

  crumbs.push({ label: pathname.split('/').filter(Boolean).join(' › ') || 'Page' });
  return crumbs;
}

function detailLabel(pathname: string, baseHref: string): string {
  const rest = pathname.slice(baseHref.length).replace(/^\//, '');
  if (!rest) return 'Detail';
  const segment = rest.split('/')[0];
  if (segment === 'onboard') return 'Onboard';
  if (/^\+?\d/.test(segment) || segment.startsWith('%2B')) return decodeURIComponent(segment);
  return decodeURIComponent(segment);
}
