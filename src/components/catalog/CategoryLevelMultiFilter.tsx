'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FlatCategoryOption } from '@/lib/categoryTreeUtils';

interface CategoryLevelMultiFilterProps {
  label: string;
  options: FlatCategoryOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

export function CategoryLevelMultiFilter({
  label,
  options,
  selectedIds,
  onChange
}: CategoryLevelMultiFilterProps) {
  const [filterText, setFilterText] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allOptionIds = useMemo(() => options.map((c) => c.id), [options]);

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return options;
    return options.filter((c) => c.breadcrumb.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
  }, [options, filterText]);

  const allSelected = options.length > 0 && allOptionIds.every((id) => selected.has(id));
  const someSelected = selectedIds.length > 0 && !allSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  function toggle(id: number) {
    if (selected.has(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  }

  function toggleSelectAll() {
    if (allSelected) onChange([]);
    else onChange(allOptionIds);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        {options.length > 0 && !allSelected && (
          <button
            type="button"
            className="text-xs font-medium text-brand-green-dark hover:underline"
            onClick={() => onChange(allOptionIds)}
          >
            Select all
          </button>
        )}
        {selectedIds.length > 0 && (
          <button type="button" className="text-xs text-gray-500 hover:text-gray-800" onClick={() => onChange([])}>
            Clear ({selectedIds.length})
          </button>
        )}
      </div>
      <input
        className="input text-sm"
        placeholder={`Filter ${label}…`}
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
        {options.length === 0 ? (
          <p className="px-3 py-3 text-center text-xs text-gray-400">None</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 hover:bg-gray-100">
              <input
                ref={selectAllRef}
                type="checkbox"
                className="h-3.5 w-3.5 rounded border-gray-300"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
              <span className="text-sm font-medium text-gray-700">
                Select all ({options.length})
              </span>
            </label>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-center text-xs text-gray-400">No matches</p>
            ) : (
              filtered.map((cat) => {
                const checked = selected.has(cat.id);
                return (
                  <label
                    key={cat.id}
                    className={`flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-gray-50 ${
                      checked ? 'bg-brand-green-light/40' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-gray-300"
                      checked={checked}
                      onChange={() => toggle(cat.id)}
                    />
                    <span className="truncate text-sm text-gray-800" title={cat.breadcrumb}>
                      {cat.name}
                    </span>
                  </label>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
}
