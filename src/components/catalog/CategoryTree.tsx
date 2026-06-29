'use client';

import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { CategoryTreeNode } from '@/lib/catalogTypes';

interface CategoryTreeProps {
  nodes: CategoryTreeNode[];
  selectedId: number | null;
  onSelect: (node: CategoryTreeNode) => void;
  /** Show expand all / collapse all controls above the tree. */
  showToolbar?: boolean;
  className?: string;
}

interface TreeContextValue {
  expanded: Set<number>;
  toggle: (id: number) => void;
  expandAll: () => void;
  collapseAll: () => void;
}

const CategoryTreeContext = createContext<TreeContextValue | null>(null);

function collectBranchIds(nodes: CategoryTreeNode[]): number[] {
  const ids: number[] = [];
  for (const node of nodes) {
    if (node.children?.length) {
      ids.push(node.id);
      ids.push(...collectBranchIds(node.children));
    }
  }
  return ids;
}

function ancestorIds(nodes: CategoryTreeNode[], targetId: number, path: number[] = []): number[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return path;
    if (node.children?.length) {
      const found = ancestorIds(node.children, targetId, [...path, node.id]);
      if (found) return found;
    }
  }
  return null;
}

function CategoryTreeNodes({
  nodes,
  selectedId,
  onSelect,
  depth = 0
}: {
  nodes: CategoryTreeNode[];
  selectedId: number | null;
  onSelect: (node: CategoryTreeNode) => void;
  depth?: number;
}) {
  const ctx = useContext(CategoryTreeContext);
  if (nodes.length === 0) return null;

  return (
    <ul className={depth === 0 ? 'space-y-0.5' : 'ml-4 border-l border-gray-100 pl-2'}>
      {nodes.map((node) => {
        const hasChildren = (node.children?.length ?? 0) > 0;
        const isExpanded = hasChildren && (ctx?.expanded.has(node.id) ?? false);
        const isSelected = selectedId === node.id;

        return (
          <li key={node.id}>
            <div
              className={clsx(
                'flex items-center gap-0.5 rounded-md transition',
                isSelected ? 'bg-brand-green-light' : 'hover:bg-gray-50'
              )}
            >
              {hasChildren ? (
                <button
                  type="button"
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  onClick={() => ctx?.toggle(node.id)}
                  className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <ChevronRight className={clsx('h-4 w-4 transition-transform', isExpanded && 'rotate-90')} />
                </button>
              ) : (
                <span className="w-6 shrink-0" />
              )}
              <button
                type="button"
                onClick={() => onSelect(node)}
                className={clsx(
                  'min-w-0 flex-1 truncate py-1.5 pr-2 text-left text-sm',
                  isSelected ? 'font-medium text-brand-green-dark' : 'text-gray-700'
                )}
              >
                <span className="truncate">{node.name}</span>
                {hasChildren && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">({node.children!.length})</span>
                )}
              </button>
              {!node.isActive && <span className="shrink-0 pr-2 text-xs text-gray-400">inactive</span>}
            </div>
            {hasChildren && isExpanded && (
              <CategoryTreeNodes nodes={node.children!} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function CategoryTree({ nodes, selectedId, onSelect, showToolbar = false, className }: CategoryTreeProps) {
  const branchIds = useMemo(() => collectBranchIds(nodes), [nodes]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const toggle = useCallback((id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpanded(new Set(branchIds));
  }, [branchIds]);

  const collapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  useEffect(() => {
    if (selectedId == null) return;
    const path = ancestorIds(nodes, selectedId);
    if (!path?.length) return;
    setExpanded((prev) => new Set([...prev, ...path]));
  }, [nodes, selectedId]);

  const ctx = useMemo<TreeContextValue>(
    () => ({ expanded, toggle, expandAll, collapseAll }),
    [expanded, toggle, expandAll, collapseAll]
  );

  if (nodes.length === 0) return null;

  return (
    <CategoryTreeContext.Provider value={ctx}>
      {showToolbar && branchIds.length > 0 && (
        <div className="mb-2 flex gap-2 border-b border-gray-100 pb-2">
          <button type="button" className="text-xs text-gray-500 hover:text-gray-800 hover:underline" onClick={expandAll}>
            Expand all
          </button>
          <span className="text-xs text-gray-300">·</span>
          <button type="button" className="text-xs text-gray-500 hover:text-gray-800 hover:underline" onClick={collapseAll}>
            Collapse all
          </button>
        </div>
      )}
      <div className={className}>
        <CategoryTreeNodes nodes={nodes} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </CategoryTreeContext.Provider>
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

/** Find the direct parent of a category, if any. */
export function findParentCategory(nodes: CategoryTreeNode[], childId: number): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.children?.some((c) => c.id === childId)) return node;
    if (node.children?.length) {
      const found = findParentCategory(node.children, childId);
      if (found) return found;
    }
  }
  return null;
}

/** Breadcrumb path from root to the target node (inclusive). */
export function categoryBreadcrumb(nodes: CategoryTreeNode[], id: number): CategoryTreeNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node];
    if (node.children?.length) {
      const tail = categoryBreadcrumb(node.children, id);
      if (tail.length > 0) return [node, ...tail];
    }
  }
  return [];
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
