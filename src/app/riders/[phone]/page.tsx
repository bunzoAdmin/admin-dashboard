'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Banknote, Wallet, ExternalLink } from 'lucide-react';
import { api, ApiClientError } from '@/lib/api';
import type { DriverDetail, EarningsSummary } from '@/lib/types';
import { Card, ErrorBox, Loading, Stat, StatusBadge, Badge, money, formatDate, SectionTitle } from '@/components/ui';
import { EarningsTab } from '@/components/driver/EarningsTab';
import { DisbursementsTab } from '@/components/driver/DisbursementsTab';
import { CashTab } from '@/components/driver/CashTab';
import { ReferralsTab } from '@/components/driver/ReferralsTab';
import { PresenceTab } from '@/components/driver/PresenceTab';
import { InKindTab } from '@/components/driver/InKindTab';
import { CashDepositModal } from '@/components/driver/CashDepositModal';
import { DisbursementModal } from '@/components/driver/DisbursementModal';
import { CurrentTripCard } from '@/components/driver/CurrentTripCard';

type Tab = 'overview' | 'presence' | 'earnings' | 'disbursements' | 'cash' | 'referrals' | 'in-kind';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'presence', label: 'Presence' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'disbursements', label: 'Disbursements' },
  { id: 'cash', label: 'Cash' },
  { id: 'referrals', label: 'Referrals' },
  { id: 'in-kind', label: 'In-Kind Rewards' }
];

function DocCard({ label, viewUrl }: { label: string; viewUrl: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600">
        {label}
        {viewUrl && (
          <a href={viewUrl} target="_blank" rel="noreferrer" className="text-brand-green hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      {viewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={viewUrl} target="_blank" rel="noreferrer">
          <img src={viewUrl} alt={label} className="h-36 w-full bg-gray-100 object-cover" />
        </a>
      ) : (
        <div className="flex h-36 items-center justify-center bg-gray-50 text-xs text-gray-400">Not provided</div>
      )}
    </div>
  );
}

export default function DriverDetailPage() {
  const params = useParams<{ phone: string }>();
  const phone = decodeURIComponent(params.phone);

  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [cashModal, setCashModal] = useState(false);
  const [disbModal, setDisbModal] = useState(false);
  const [cashRefresh, setCashRefresh] = useState(0);
  const [tripRefresh, setTripRefresh] = useState(0);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDriver(await api.getDriver(phone));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) setError('No driver found with that phone number.');
      else setError(err instanceof ApiClientError ? err.message : 'Failed to load driver.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchEarningsSummary = useCallback(() => {
    api.getDriverEarnings(phone).then(setEarningsSummary).catch(() => {});
  }, [phone]);

  useEffect(() => {
    if (tab !== 'in-kind' || earningsSummary !== null) return;
    fetchEarningsSummary();
  }, [tab, earningsSummary, fetchEarningsSummary]);

  const afterAction = () => {
    load();
    setCashRefresh((n) => n + 1);
    setTripRefresh((n) => n + 1);
  };

  return (
    <div className="space-y-6">
      <Link href="/riders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to lookup
      </Link>

      {loading && <Loading label="Loading driver…" />}
      {error && !loading && <ErrorBox message={error} />}

      {driver && !loading && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {driver.profile_view_url ? (
                <img src={driver.profile_view_url} alt={driver.name} className="h-16 w-16 rounded-full object-cover" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-green-light text-lg font-bold text-brand-green-dark">
                  {driver.name?.[0]?.toUpperCase() ?? '?'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900">{driver.name}</h1>
                  <StatusBadge status={driver.status} />
                  {driver.cash_blocked && <Badge tone="red">Cash blocked</Badge>}
                </div>
                <div className="text-sm text-gray-500">{driver.phone_number}</div>
                <div className="mt-0.5 font-mono text-xs text-gray-400">{driver.de_id}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setCashModal(true)}>
                <Wallet className="h-4 w-4" /> Record cash deposit
              </button>
              <button className="btn-primary" onClick={() => setDisbModal(true)}>
                <Banknote className="h-4 w-4" /> Record disbursement
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Today's earnings" value={money(driver.today_earnings_zmw)} />
            <Stat label="Trips today" value={driver.trips_today} />
            <Stat label="Total trips" value={driver.total_trips_completed} />
            <Stat
              label="Cash in hand"
              value={money(driver.in_hand_cash_zmw)}
              sub={`Limit ${money(driver.cash_limit_zmw)}`}
            />
          </div>

          <div className="border-b border-gray-200">
            <div className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    tab === t.id ? 'border-brand-green text-brand-green-dark' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {tab === 'overview' && (
            <div className="space-y-6">
              <CurrentTripCard phone={phone} refreshKey={tripRefresh} onTripChanged={afterAction} />

              <Card>
                <SectionTitle>Documents</SectionTitle>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <DocCard label="Profile photo" viewUrl={driver.profile_view_url} />
                  <DocCard label="NRC" viewUrl={driver.nrc_view_url} />
                  <DocCard label="Driver license" viewUrl={driver.driver_license_view_url} />
                </div>
              </Card>

              <Card>
                <SectionTitle>Account</SectionTitle>
                <dl className="space-y-2 text-sm">
                  <Row label="NRC number" value={driver.nrc_number || '—'} />
                  <Row label="Airtel Money number" value={driver.airtel_money_number || '—'} />
                  <Row label="Bike number" value={driver.bike_number || '—'} />
                  <Row label="Bike brand" value={driver.bike_brand || '—'} />
                  <Row label="Referral code" value={driver.referral_code || '—'} mono />
                  <Row label="Last disbursed" value={formatDate(driver.last_disbursed_at)} />
                  <Row label="Joined" value={formatDate(driver.created_at)} />
                  <Row label="Updated" value={formatDate(driver.updated_at)} />
                </dl>
              </Card>
            </div>
          )}

          {tab === 'presence' && <PresenceTab phone={phone} />}
          {tab === 'earnings' && <EarningsTab phone={phone} />}
          {tab === 'disbursements' && <DisbursementsTab phone={phone} />}
          {tab === 'cash' && <CashTab phone={phone} refreshKey={cashRefresh} />}
          {tab === 'referrals' && <ReferralsTab phone={phone} />}
          {tab === 'in-kind' && (
            <InKindTab
              phone={phone}
              summary={earningsSummary?.in_kind_summary ?? []}
              onDisbursed={fetchEarningsSummary}
            />
          )}

          <CashDepositModal
            open={cashModal}
            onClose={() => setCashModal(false)}
            phone={driver.phone_number}
            inHandCash={driver.in_hand_cash_zmw}
            onDone={afterAction}
          />
          <DisbursementModal
            open={disbModal}
            onClose={() => setDisbModal(false)}
            deId={driver.de_id}
            phone={driver.phone_number}
            onDone={afterAction}
          />
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className={`text-right text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  );
}
