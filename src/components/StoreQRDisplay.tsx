'use client';

import clsx from 'clsx';
import { Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import QRCode from 'react-qr-code';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiClientError } from '@/lib/api';
import type { StoreQR } from '@/lib/types';
import { ErrorBox, Loading, Spinner } from './ui';

function formatCountdown(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function StoreQRDisplay({ storeId }: { storeId: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<StoreQR | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [viewport, setViewport] = useState({ w: 1024, h: 768 });

  useEffect(() => {
    function updateViewport() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  const fetchQR = useCallback(
    async (silent = false) => {
      if (!storeId.trim()) return;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        setData(await api.getStoreQR(storeId.trim()));
      } catch (err) {
        setData(null);
        setError(err instanceof ApiClientError ? err.message : 'Failed to load QR code.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [storeId]
  );

  useEffect(() => {
    fetchQR();
  }, [fetchQR]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!data?.valid_until) return;
    const expires = new Date(data.valid_until).getTime();
    const ms = expires - Date.now();
    if (ms <= 0) {
      fetchQR(true);
      return;
    }
    const id = setTimeout(() => fetchQR(true), ms + 500);
    return () => clearTimeout(id);
  }, [data?.valid_until, data?.qr_code, fetchQR]);

  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  async function toggleFullscreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
  }

  const validUntil = data ? new Date(data.valid_until) : null;
  const secondsLeft = validUntil ? Math.max(0, Math.floor((validUntil.getTime() - now) / 1000)) : 0;
  const qrSize = isFullscreen ? Math.min(viewport.w, viewport.h) * 0.55 : 256;

  if (loading) {
    return (
      <div className="card flex min-h-[22rem] items-center justify-center p-8">
        <Loading label="Generating QR code…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card space-y-4 p-6">
        <ErrorBox message={error} />
        <button type="button" className="btn-ghost" onClick={() => fetchQR()}>
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      ref={containerRef}
      className={clsx(
        'card overflow-hidden',
        isFullscreen && 'flex min-h-full w-full flex-col items-center justify-center rounded-none border-0 bg-white p-8 shadow-none'
      )}
    >
      <div className={clsx('flex w-full items-start justify-between gap-4', isFullscreen && 'absolute left-0 right-0 top-0 p-6')}>
        <div>
          <div className={clsx('font-bold text-gray-900', isFullscreen ? 'text-2xl' : 'text-lg')}>Store {data.store_id}</div>
          <div className={clsx('text-gray-500', isFullscreen ? 'text-base' : 'text-sm')}>
            Drivers scan this to start duty · refreshes in{' '}
            <span className="font-mono font-medium text-gray-700">{formatCountdown(secondsLeft)}</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => fetchQR(true)}
            disabled={refreshing}
            title="Refresh now"
          >
            {refreshing ? <Spinner className="h-4 w-4" /> : <RefreshCw className="h-4 w-4" />}
          </button>
          <button type="button" className="btn-primary" onClick={toggleFullscreen}>
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4 w-4" />
                Exit fullscreen
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                Fullscreen
              </>
            )}
          </button>
        </div>
      </div>

      <div className={clsx('flex flex-col items-center', isFullscreen ? 'mt-0 flex-1 justify-center' : 'mt-8 pb-4')}>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <QRCode value={data.qr_code} size={qrSize} level="M" />
        </div>
        {!isFullscreen && (
          <p className="mt-4 text-center text-xs text-gray-400">
            QR rotates every hour (Zambia time). Use fullscreen on a store tablet or TV.
          </p>
        )}
        {isFullscreen && (
          <p className="mt-6 text-center text-sm text-gray-400">
            Valid until {validUntil?.toLocaleString()} · auto-refreshes when the hour changes
          </p>
        )}
      </div>
    </div>
  );
}
