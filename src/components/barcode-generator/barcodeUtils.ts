import type { CategoryTreeNode } from '@/lib/catalogTypes';

export function flattenCategories(
  nodes: CategoryTreeNode[],
  depth = 0
): { id: number; name: string }[] {
  return nodes.flatMap((n) => [
    { id: n.id, name: '\u00a0\u00a0'.repeat(depth) + n.name },
    ...flattenCategories(n.children ?? [], depth + 1)
  ]);
}

export function formatBarcodeDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
