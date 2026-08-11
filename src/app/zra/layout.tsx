'use client';

import { ZraStoreProvider } from '@/components/zra/ZraStoreSelector';

export default function ZraLayout({ children }: { children: React.ReactNode }) {
  return <ZraStoreProvider>{children}</ZraStoreProvider>;
}
