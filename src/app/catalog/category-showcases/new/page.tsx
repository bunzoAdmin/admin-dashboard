'use client';

import { CategoryShowcaseGroupForm } from '@/components/catalog/CategoryShowcaseGroupForm';

export default function NewCategoryShowcasePage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-gray-900">New category showcase group</h1>
        <p className="text-sm text-gray-500">Create a group, then add L2/L3 categories on the next screen.</p>
      </div>
      <CategoryShowcaseGroupForm />
    </div>
  );
}
