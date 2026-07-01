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

export interface StoreQR {
  store_id: string;
  qr_code: string;
  valid_until: string;
}

export interface DailyMilestone {
  trips_today: number;
  next_threshold?: number;
  reward_zmw?: number;
  achieved?: boolean;
  [key: string]: unknown;
}

export type TripStatus =
  | 'created'
  | 'assigned'
  | 'accepted'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export type TaskType = 'pickup' | 'drop';
export type TaskStatus = 'created' | 'completed';

export interface TripTask {
  task_id: string;
  type: TaskType;
  status: TaskStatus;
  created_at?: string;
  completed_at?: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  recipient_name?: string;
}

export interface TripItem {
  name: string;
  image_url: string;
  quantity: number;
  sku?: string;
}

export interface TripPayment {
  collect_cash: boolean;
  amount_zmw: number;
  currency?: string;
}

export interface Trip {
  trip_id: string;
  order_id: string;
  store_id: string;
  de_id?: string;
  de_phone?: string;
  status: TripStatus;
  tasks: TripTask[];
  items?: TripItem[];
  payment?: TripPayment;
  distance_km?: number;
  base_pay_zmw?: number;
  created_at: string;
  updated_at: string;
  assigned_at?: string;
}

export interface DriverTripResponse {
  trip: Trip | null;
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
  nrc_number: string;
  airtel_money_number: string;
  bike_number: string;
  bike_brand: string;
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

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface AdminDispute {
  dispute_id: string;
  order_number: string;
  customer_id: string;
  disposition_code: string;
  disposition_title?: string;
  description?: string;
  photo_urls?: string[];
  status: DisputeStatus;
  resolution_note?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface DisputeOrderEvidence {
  order_number: string;
  items: Array<{ name: string; image_url: string; quantity: number }>;
  pickup_completed_at?: string;
  drop_completed_at?: string;
  driver_photo_url?: string;
}

export interface DisputeDriverDetail {
  de_id: string;
  name: string;
  phone_number: string;
  total_trips_completed: number;
  created_at: string;
}

export interface AdminDisputeDetail extends AdminDispute {
  order?: DisputeOrderEvidence;
  driver?: DisputeDriverDetail;
}

export interface DisputeListResponse {
  disputes: AdminDispute[];
  next_cursor: string;
}

export interface DisputeSummary {
  open: number;
  under_review: number;
  resolved: number;
  rejected: number;
}
