'use client';

import { useMemo, useState } from 'react';
import type { CategoryTreeNode } from '@/lib/catalogTypes';
import {
  categoryBreadcrumbLabel,
  flattenTreeForLeafCategories,
  type FlatCategoryOption
} from '@/lib/categoryTreeUtils';

interface LeafCategoryPickerProps {
  categories: CategoryTreeNode[];
  value: string;
  onChange: (categoryId: string) => void;
}

export function LeafCategoryPicker({ categories, value, onChange }: LeafCategoryPickerProps) {
  const [filterText, setFilterText] = useState('');
  const leaves = useMemo(() => flattenTreeForLeafCategories(categories), [categories]);
  const leafIds = useMemo(() => new Set(leaves.map((c) => c.id)), [leaves]);

  const selectedId = value ? parseInt(value, 10) : NaN;
  const hasSelection = Number.isFinite(selectedId);
  const isLeaf = hasSelection && leafIds.has(selectedId);
  const staleLabel =
    hasSelection && !isLeaf ? categoryBreadcrumbLabel(categories, selectedId) ?? `#${selectedId}` : null;

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return leaves;
    return leaves.filter((c) => c.breadcrumb.toLowerCase().includes(q));
  }, [leaves, filterText]);

  const selectedLeaf: FlatCategoryOption | undefined = isLeaf
    ? leaves.find((c) => c.id === selectedId)
    : undefined;

  return (
    <div className="space-y-2">
      {staleLabel && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Current category is not a leaf: <span className="font-medium">{staleLabel}</span>. Pick a
          leaf category below to save.
        </div>
      )}
      {selectedLeaf && (
        <p className="text-xs text-gray-500">
          Selected: <span className="font-medium text-gray-800">{selectedLeaf.breadcrumb}</span>
        </p>
      )}
      <input
        className="input text-sm"
        placeholder="Search leaf categories…"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
      />
      <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-gray-400">
            No leaf categories found. Only categories without subcategories can be assigned.
          </p>
        ) : (
          filtered.map((cat) => {
            const checked = isLeaf && cat.id === selectedId;
            return (
              <label
                key={cat.id}
                className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-gray-50 ${
                  checked ? 'bg-brand-green-light/50' : ''
                }`}
              >
                <input
                  type="radio"
                  name="product-leaf-category"
                  className="h-4 w-4 border-gray-300 text-brand-green"
                  checked={checked}
                  onChange={() => onChange(String(cat.id))}
                />
                <span className="text-sm text-gray-800">{cat.breadcrumb}</span>
                <span className="ml-auto shrink-0 text-xs text-gray-400">#{cat.id}</span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

/** True when value is empty or points at a leaf category. */
export function isLeafCategorySelection(categories: CategoryTreeNode[], categoryId: string): boolean {
  const id = parseInt(categoryId, 10);
  if (!Number.isFinite(id)) return false;
  const leaves = flattenTreeForLeafCategories(categories);
  return leaves.some((c) => c.id === id);
}
