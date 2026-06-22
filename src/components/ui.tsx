'use client';

import clsx from 'clsx';
import { Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { DEStatus } from '@/lib/types';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('card p-5', className)}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-900">{children}</h2>
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  className
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={clsx('block space-y-1.5', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin', className)} />;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
      <Spinner className="h-4 w-4" /> {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-400">{children}</div>;
}

const STATUS_STYLES: Record<DEStatus, string> = {
  offline: 'bg-gray-100 text-gray-600',
  eligible: 'bg-green-100 text-green-700',
  busy: 'bg-amber-100 text-amber-700',
  free: 'bg-blue-100 text-blue-700'
};

export function StatusBadge({ status }: { status: DEStatus }) {
  return (
    <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600')}>
      {status}
    </span>
  );
}

export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700'
  };
  return <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className="mt-1 text-xl font-bold text-gray-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

export function money(zmw: number | undefined | null): string {
  const n = typeof zmw === 'number' ? zmw : 0;
  return `K${n.toFixed(2)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

// --- Toast ---
interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}
interface ToastCtx {
  push: (kind: Toast['kind'], message: string) => void;
}
const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismiss = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={clsx(
              'flex items-start gap-2 rounded-lg border p-3 text-sm shadow-card',
              t.kind === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'
            )}
          >
            {t.kind === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-current/60 hover:text-current">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
