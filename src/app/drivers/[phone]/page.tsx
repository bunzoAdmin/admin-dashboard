import { redirect } from 'next/navigation';

export default async function LegacyDriverDetail({ params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params;
  redirect(`/riders/${phone}`);
}
