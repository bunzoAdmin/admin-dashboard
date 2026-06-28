import Link from 'next/link';
import { AlertTriangle, ClipboardList, FolderTree, PackagePlus, ScanBarcode, Users } from 'lucide-react';

const QUICK_LINKS = [
  { href: '/orders/disputes', label: 'Disputes', icon: AlertTriangle, desc: 'Customer issue triage' },
  { href: '/riders', label: 'Riders', icon: Users, desc: 'Driver lookup and ops' },
  { href: '/pickers', label: 'Pickers', icon: ClipboardList, desc: 'Live roster and pick task queue' },
  { href: '/inventory', label: 'Inventory', icon: PackagePlus, desc: 'Scan barcode — add or transfer stock' },
  { href: '/catalog/products', label: 'Products', icon: ScanBarcode, desc: 'Scan barcode to create or edit' },
  { href: '/catalog/categories', label: 'Categories', icon: FolderTree, desc: 'Category tree management' }
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Home</h1>
        <p className="text-sm text-gray-500">Bunzo operations console — pick a section to get started.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK_LINKS.map(({ href, label, icon: Icon, desc }) => (
          <Link
            key={href}
            href={href}
            className="card flex items-start gap-4 p-5 transition hover:border-brand-green/30 hover:shadow-card"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-green-light text-brand-green-dark">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold text-gray-900">{label}</div>
              <div className="text-sm text-gray-500">{desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
