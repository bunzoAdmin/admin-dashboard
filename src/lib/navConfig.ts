import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Database,
  FolderTree,
  History,
  Home,
  Image,
  Layers,
  LayoutGrid,
  List,
  Medal,
  Package,
  PackageCheck,
  PackagePlus,
  Plus,
  QrCode,
  ScanBarcode,
  Settings,
  Settings2,
  SlidersHorizontal,
  Timer,
  Ticket,
  UserCog,
  UserPlus,
  Users,
  Warehouse,
  ClipboardList,
  Clock,
  MapPin,
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
      { href: '/orders/list', label: 'All Orders', icon: List },
      { href: '/orders/disputes', label: 'Disputes', icon: AlertTriangle, disputeBadge: true },
      { href: '/orders/assign', label: 'Assign Order', icon: PackageCheck }
    ]
  },
  {
    id: 'riders',
    label: 'Riders',
    items: [
      { href: '/riders', label: 'All Riders', icon: Users, exact: true },
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
      { href: '/catalog/products/browse', label: 'Browse', icon: Package },
      { href: '/catalog/banners', label: 'Banners', icon: Image },
      { href: '/catalog/slots', label: 'Banner Schedules', icon: Timer },
      { href: '/catalog/showcases', label: 'Product Showcases', icon: Layers },
      { href: '/catalog/category-showcases', label: 'Category Showcases', icon: LayoutGrid }
    ]
  },
  {
    id: 'barcode-generator',
    label: 'Barcode Generator',
    items: [
      { href: '/barcode-generator/list', label: 'List of Barcodes', icon: List },
      { href: '/barcode-generator/generate', label: 'Generate Labels', icon: Plus }
    ]
  },
  {
    id: 'qr-campaigns',
    label: 'QR Campaigns',
    items: [
      { href: '/qr-campaigns', label: 'All Campaigns', icon: QrCode, exact: true },
      { href: '/qr-campaigns/new', label: 'Create Campaign', icon: Plus }
    ]
  },
  {
    id: 'pickers',
    label: 'Pickers',
    items: [
      { href: '/pickers', label: 'Live Ops', icon: ClipboardList, exact: true },
      { href: '/pickers/onboard', label: 'Onboard', icon: UserPlus },
      { href: '/pickers/shifts', label: 'Shifts', icon: Clock },
      { href: '/pickers/reconcile', label: 'Sync Failures', icon: RefreshCw }
    ]
  },
  {
    id: 'inventory',
    label: 'Inventory',
    items: [
      { href: '/inventory', label: 'Inwarding', icon: PackagePlus, exact: true },
      { href: '/inventory/browse', label: 'Browse stock', icon: LayoutGrid },
      { href: '/inventory/audit', label: 'Location audit', icon: MapPin },
      { href: '/inventory/alerts', label: 'Alerts', icon: AlertTriangle },
      { href: '/inventory/discrepancies', label: 'Discrepancies', icon: BarChart2 },
      { href: '/inventory/movements', label: 'Movements', icon: History }
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { href: '/finance/refunds', label: 'Stuck Refunds', icon: RefreshCw },
      { href: '/finance/coupons', label: 'Coupons', icon: Ticket }
    ]
  },
  {
    id: 'search',
    label: 'Search',
    items: [
      { href: '/search/synonyms', label: 'Synonyms', icon: BookOpen },
      { href: '/search/settings', label: 'Settings', icon: Settings },
      { href: '/search/index', label: 'Index', icon: Database }
    ]
  },
  {
    id: 'stores',
    label: 'Stores',
    items: [
      { href: '/stores/onboard', label: 'Onboard Store', icon: Warehouse },
      { href: '/stores/manage', label: 'Manage Store', icon: Settings2 },
      { href: '/stores/qr', label: 'Store QR', icon: QrCode }
    ]
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
