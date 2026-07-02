import { redirect } from 'next/navigation';

export default function BarcodeGeneratorIndexPage() {
  redirect('/barcode-generator/list');
}
