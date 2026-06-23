export type DEStatus = 'offline' | 'eligible' | 'busy' | 'free';

export interface AdminUser {
  username: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  token_type: string;
  expires_in: number;
  user: AdminUser;
}

export interface DailyMilestone {
  trips_today: number;
  next_threshold?: number;
  reward_zmw?: number;
  achieved?: boolean;
  [key: string]: unknown;
}

export interface DriverDetail {
  de_id: string;
  phone_number: string;
  name: string;
  status: DEStatus;
  profile_url: string;
  profile_view_url: string;
  nrc_url: string;
  nrc_view_url: string;
  driver_license_url: string;
  driver_license_view_url: string;
  referral_code: string;
  current_store_id: string;
  current_order_id: string;
  current_trip_id: string;
  trips_today: number;
  total_trips_completed: number;
  in_hand_cash_zmw: number;
  today_earnings_zmw: number;
  last_disbursed_at: string;
  created_at: string;
  updated_at: string;
  cash_limit_zmw: number;
  cash_blocked: boolean;
  daily_milestone?: DailyMilestone;
}

export interface EarningsLineItem {
  earning_id: string;
  type: string;
  amount_zmw: number;
  label?: string;
  created_at: string;
  reference_id: string;
}

export interface EarningsSummary {
  outstanding_balance_zmw: number;
  live_order_total_zmw: number;
  bonus_total_zmw: number;
  line_items: EarningsLineItem[];
  next_cursor: string | null;
}

export interface Disbursement {
  disbursement_id: string;
  amount_zmw: number;
  period_from: string;
  period_to: string;
  disbursed_at: string;
}

export interface ReferralItem {
  referred_de_id: string;
  referred_name?: string;
  status: string;
  created_at: string;
  window_expires_at: string;
  payout_triggered_at?: string;
}

export interface ReferralScreen {
  referral_code: string;
  reward_zmw: number;
  referrals: ReferralItem[];
}

export interface CashDeposit {
  deposit_id: string;
  requested_amount_zmw: number;
  applied_amount_zmw: number;
  created_at: string;
}

export interface CashLedger {
  in_hand_cash_zmw: number;
  deposits: CashDeposit[];
}

export type RuleFamily = 'rate_modifier' | 'accumulator' | 'ranking';

export interface Reward {
  kind: 'cash' | 'in_kind';
  amount_zmw: number;
  label: string;
  sku: string;
}

export interface RateModifierSpec {
  days_of_week: number[];
  start_time: string;
  end_time: string;
  multiplier: number;
  flat_zmw: number;
}

export interface AccumulatorSpec {
  metric: string;
  window: 'daily' | 'weekly';
  threshold: number;
  require_no_fail: boolean;
  min_on_time_rate: number;
  reward: Reward;
}

export interface RankingSpec {
  window: 'weekly';
  top_n: number;
  min_on_time: number;
  weight_rate: number;
  weight_volume: number;
  reward: Reward;
}

export interface Rule {
  id: string;
  name: string;
  family: RuleFamily;
  enabled: boolean;
  effective_from?: string | null;
  effective_to?: string | null;
  priority: number;
  version: number;
  spec: RateModifierSpec | AccumulatorSpec | RankingSpec | Record<string, unknown>;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface PresignResponse {
  upload_url: string;
  object_key: string;
  expires_in_seconds: number;
}
