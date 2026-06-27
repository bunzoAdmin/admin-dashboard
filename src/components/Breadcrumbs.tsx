'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { breadcrumbsForPath } from '@/lib/navConfig';

export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  const crumbs = breadcrumbsForPath(pathname);
  if (crumbs.length <= 1 && pathname === '/') return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-1 text-sm text-gray-500">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex items-center gap-1">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-300" />}
            {crumb.href && !isLast ? (
              <Link href={crumb.href} className="hover:text-gray-700">
                {crumb.label}
              </Link>
            ) : (
              <span className={isLast ? 'font-medium text-gray-900' : undefined}>{crumb.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
