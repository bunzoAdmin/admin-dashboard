'use client';

import { Copy } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useToast } from '@/components/ui';

interface PinRevealModalProps {
  open: boolean;
  pin: string | null;
  title: string;
  onClose: () => void;
}

export function PinRevealModal({ open, pin, title, onClose }: PinRevealModalProps) {
  const toast = useToast();

  async function copyPin() {
    if (!pin) return;
    try {
      await navigator.clipboard.writeText(pin);
      toast.push('success', 'PIN copied.');
    } catch {
      toast.push('error', 'Could not copy PIN.');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600">Share this PIN with the picker. It will not be shown again after you close this dialog.</p>
        <div className="flex items-center justify-center gap-3 rounded-lg border border-gray-200 bg-gray-50 py-6">
          <span className="font-mono text-3xl font-bold tracking-[0.3em] text-gray-900">{pin ?? '—'}</span>
          <button type="button" className="btn-ghost px-2 py-2" onClick={copyPin} title="Copy PIN">
            <Copy className="h-4 w-4" />
          </button>
        </div>
        <div className="flex justify-end">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
