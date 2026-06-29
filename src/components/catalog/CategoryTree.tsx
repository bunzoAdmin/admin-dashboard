'use client';

import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import type { CategoryTreeNode } from '@/lib/catalogTypes';

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  selectedId: number | null;
  onSelect: (node: CategoryTreeNode) => void;
  depth?: number;
}

export function CategoryTree({ nodes, selectedId, onSelect, depth = 0 }: CategoryTreeProps) {
  if (nodes.length === 0) return null;

  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'ml-3 border-l border-gray-100 pl-2'}>
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={clsx(
              'flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm transition',
              selectedId === node.id ? 'bg-brand-green-light font-medium text-brand-green-dark' : 'text-gray-700 hover:bg-gray-50'
            )}
          >
            {node.children && node.children.length > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            ) : (
              <span className="w-3.5 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
            {!node.isActive && <span className="ml-auto text-xs text-gray-400">inactive</span>}
          </button>
          {node.children && node.children.length > 0 && (
            <CategoryTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

/** Flatten tree for select dropdowns. */
export function flattenCategoryTree(nodes: CategoryTreeNode[], prefix = ''): { id: number; label: string }[] {
  const out: { id: number; label: string }[] = [];
  for (const node of nodes) {
    const label = prefix ? `${prefix} › ${node.name}` : node.name;
    out.push({ id: node.id, label });
    if (node.children?.length) {
      out.push(...flattenCategoryTree(node.children, label));
    }
  }
  return out;
}

/** Find a category node by ID in the tree. */
export function findCategoryInTree(nodes: CategoryTreeNode[], id: number): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findCategoryInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

/** Depth of a node in the tree (1 = root). */
export function categoryDepth(nodes: CategoryTreeNode[], id: number, depth = 1): number | null {
  for (const node of nodes) {
    if (node.id === id) return depth;
    if (node.children?.length) {
      const d = categoryDepth(node.children, id, depth + 1);
      if (d != null) return d;
    }
  }
  return null;
}
