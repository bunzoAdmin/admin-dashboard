'use client';

import { SlotForm } from '@/components/catalog/SlotForm';

export default function NewSlotPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">New banner schedule</h1>
        <p className="text-sm text-gray-500">
          Define a recurring schedule with a name, days, time window, and priority. Then assign banners to it. All times are Africa/Lusaka (CAT = UTC+2, no DST).
        </p>
      </div>
      <SlotForm />
    </div>
  );
}
