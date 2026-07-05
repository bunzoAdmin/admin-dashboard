import type { CategoryTreeNode } from '@/lib/catalogTypes';

export interface FlatCategoryOption {
  id: number;
  name: string;
  breadcrumb: string;
}

/** Flatten category tree to L2 and L3 only (L1 roots are not selectable). */
export function flattenTreeForL2L3(nodes: CategoryTreeNode[], parentName?: string): FlatCategoryOption[] {
  const result: FlatCategoryOption[] = [];
  for (const node of nodes) {
    if (parentName !== undefined) {
      const breadcrumb = parentName ? `${parentName} > ${node.name}` : node.name;
      result.push({ id: node.id, name: node.name, breadcrumb });
      if (node.children?.length) {
        result.push(...flattenTreeForL2L3(node.children, breadcrumb));
      }
    } else if (node.children?.length) {
      result.push(...flattenTreeForL2L3(node.children, node.name));
    }
  }
  return result;
}
