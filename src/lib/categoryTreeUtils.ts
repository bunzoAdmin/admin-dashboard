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

/**
 * Leaf categories only (no children), excluding L1 roots.
 * Used where a linked category must map directly to products.
 */
export function flattenTreeForLeafCategories(
  nodes: CategoryTreeNode[],
  parentName?: string
): FlatCategoryOption[] {
  const result: FlatCategoryOption[] = [];
  for (const node of nodes) {
    if (parentName !== undefined) {
      const breadcrumb = parentName ? `${parentName} > ${node.name}` : node.name;
      const hasChildren = (node.children?.length ?? 0) > 0;
      if (!hasChildren) {
        result.push({ id: node.id, name: node.name, breadcrumb });
      } else {
        result.push(...flattenTreeForLeafCategories(node.children!, breadcrumb));
      }
    } else if (node.children?.length) {
      result.push(...flattenTreeForLeafCategories(node.children, node.name));
    }
  }
  return result;
}

/** IDs in selectedIds that are not present in the allowed leaf options. */
export function findInvalidCategorySelections(
  selectedIds: number[],
  allowed: FlatCategoryOption[]
): number[] {
  const allowedIds = new Set(allowed.map((c) => c.id));
  return selectedIds.filter((id) => !allowedIds.has(id));
}

/** Flatten categories at a specific depth (1 = L1 roots). */
export function flattenTreeAtDepth(
  nodes: CategoryTreeNode[],
  targetDepth: number,
  depth = 1,
  parentName?: string
): FlatCategoryOption[] {
  const result: FlatCategoryOption[] = [];
  for (const node of nodes) {
    const breadcrumb = parentName ? `${parentName} > ${node.name}` : node.name;
    if (depth === targetDepth) {
      result.push({ id: node.id, name: node.name, breadcrumb });
    } else if (node.children?.length && depth < targetDepth) {
      result.push(...flattenTreeAtDepth(node.children, targetDepth, depth + 1, breadcrumb));
    }
  }
  return result;
}

/** All IDs in a node's subtree, including itself. */
export function collectSubtreeIds(node: CategoryTreeNode): number[] {
  const ids = [node.id];
  for (const child of node.children ?? []) {
    ids.push(...collectSubtreeIds(child));
  }
  return ids;
}

/**
 * Expand selected category IDs to include every descendant (union of subtrees).
 * Used when filtering products by L1/L2/L3 picks at any level.
 */
export function expandCategorySelectionToSubtreeIds(
  tree: CategoryTreeNode[],
  selectedIds: number[]
): Set<number> {
  if (selectedIds.length === 0) return new Set();
  const selected = new Set(selectedIds);
  const result = new Set<number>();

  function walk(nodes: CategoryTreeNode[]) {
    for (const node of nodes) {
      if (selected.has(node.id)) {
        for (const id of collectSubtreeIds(node)) result.add(id);
      } else if (node.children?.length) {
        walk(node.children);
      }
    }
  }

  walk(tree);
  return result;
}

/** Breadcrumb label for any category id, or null if missing. */
export function categoryBreadcrumbLabel(nodes: CategoryTreeNode[], id: number): string | null {
  function walk(list: CategoryTreeNode[], prefix: string): string | null {
    for (const node of list) {
      const label = prefix ? `${prefix} > ${node.name}` : node.name;
      if (node.id === id) return label;
      if (node.children?.length) {
        const found = walk(node.children, label);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(nodes, '');
}
