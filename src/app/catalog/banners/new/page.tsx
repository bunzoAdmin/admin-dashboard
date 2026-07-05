'use client';

import { BannerForm } from '@/components/catalog/BannerForm';

export default function NewBannerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">New banner</h1>
        <p className="text-sm text-gray-500">
          Create a banner then assign it to a time slot to schedule when it appears.
        </p>
      </div>
      <BannerForm />
    </div>
  );
}
