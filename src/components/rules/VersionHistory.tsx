'use client';

import { useEffect, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import { Modal } from '@/components/Modal';
import { Badge, ErrorBox, Loading } from '@/components/ui';
import type { Rule } from '@/lib/types';

export function VersionHistory({ id, onClose }: { id: string; onClose: () => void }) {
  const [versions, setVersions] = useState<Rule[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setVersions(await api.listRuleVersions(id));
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'Failed to load history.');
      }
    })();
  }, [id]);

  return (
    <Modal open onClose={onClose} title={`Version history · ${id}`}>
      {error && <ErrorBox message={error} />}
      {!versions && !error && <Loading />}
      {versions && (
        <div className="space-y-2">
          {versions.map((v) => (
            <div key={v.version} className="flex items-center justify-between rounded-lg border border-gray-200 p-3">
              <div>
                <div className="text-sm font-medium text-gray-900">v{v.version}</div>
                <div className="text-xs text-gray-500">{v.name}</div>
              </div>
              <Badge tone={v.enabled ? 'green' : 'gray'}>{v.enabled ? 'enabled' : 'disabled'}</Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
