'use client';

import Link from 'next/link';
import { ShowcaseGroupForm } from '@/components/catalog/ShowcaseGroupForm';
import { Card } from '@/components/ui';

export default function NewShowcasePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/catalog/showcases" className="text-sm text-gray-500 hover:text-gray-700">
          ← All showcase groups
        </Link>
        <h1 className="mt-2 text-xl font-bold text-gray-900">New showcase group</h1>
        <p className="text-sm text-gray-500">
          Create a named product collection. You can add products after saving.
        </p>
      </div>

      <Card>
        <ShowcaseGroupForm />
      </Card>
    </div>
  );
}
