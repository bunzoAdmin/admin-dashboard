'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, History, Power } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import type { Rule } from '@/lib/types';
import { Badge, Card, ErrorBox, Loading, EmptyState, useToast } from '@/components/ui';
import { RuleEditor } from '@/components/rules/RuleEditor';
import { VersionHistory } from '@/components/rules/VersionHistory';

const FAMILY_LABEL: Record<string, string> = {
  rate_modifier: 'Rate modifier',
  accumulator: 'Accumulator',
  ranking: 'Ranking'
};

export default function RulesPage() {
  const toast = useToast();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: 'create' | 'edit'; rule?: Rule } | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [disabling, setDisabling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRules(await api.listRules());
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Failed to load rules.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function disable(rule: Rule) {
    if (!confirm(`Disable rule "${rule.name}"? This creates a new disabled version.`)) return;
    setDisabling(rule.id);
    try {
      await api.deleteRule(rule.id);
      toast.push('success', `Rule "${rule.name}" disabled.`);
      load();
    } catch (err) {
      toast.push('error', err instanceof ApiClientError ? err.message : 'Failed to disable rule.');
    } finally {
      setDisabling(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payout rules</h1>
          <p className="text-sm text-gray-500">Configure surge rates, accumulator bonuses, and ranking rewards.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditor({ mode: 'create' })}>
          <Plus className="h-4 w-4" /> New rule
        </button>
      </div>

      {error && <ErrorBox message={error} />}
      {!rules && !error && <Loading label="Loading rules…" />}

      {rules && rules.length === 0 && <EmptyState>No payout rules configured yet.</EmptyState>}

      {rules && rules.length > 0 && (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="px-5 py-3 font-medium">Rule</th>
                <th className="px-5 py-3 font-medium">Family</th>
                <th className="px-5 py-3 font-medium">Priority</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Version</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium text-gray-900">{r.name}</div>
                    <div className="font-mono text-xs text-gray-400">{r.id}</div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{FAMILY_LABEL[r.family] ?? r.family}</td>
                  <td className="px-5 py-3 text-gray-600">{r.priority}</td>
                  <td className="px-5 py-3">
                    <Badge tone={r.enabled ? 'green' : 'gray'}>{r.enabled ? 'enabled' : 'disabled'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-gray-600">v{r.version}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" title="Edit" onClick={() => setEditor({ mode: 'edit', rule: r })}>
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100" title="Version history" onClick={() => setHistoryId(r.id)}>
                        <History className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-md p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Disable"
                        disabled={!r.enabled || disabling === r.id}
                        onClick={() => disable(r)}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {editor && <RuleEditor mode={editor.mode} initial={editor.rule} onClose={() => setEditor(null)} onSaved={load} />}
      {historyId && <VersionHistory id={historyId} onClose={() => setHistoryId(null)} />}
    </div>
  );
}
