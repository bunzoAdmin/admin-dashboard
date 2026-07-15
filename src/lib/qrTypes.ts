export interface QrCampaign {
  campaign_id: string;
  name: string;
  description?: string;
  enabled: boolean;
  placement_slugs?: string[];
  created_at: string;
  updated_at: string;
}

export interface QrPlacement {
  slug: string;
  campaign_id: string;
  name: string;
  location?: string;
  enabled: boolean;
  scan_count: number;
  unique_count: number;
  ios_count: number;
  android_count: number;
  other_count: number;
  bot_count: number;
  created_at: string;
  updated_at: string;
  url: string;
}

export interface QrCampaignDetail {
  campaign: QrCampaign;
  placements: QrPlacement[];
}

export interface QrDailyBucket {
  date: string;
  scans: number;
}

export interface QrPlacementAnalytics {
  slug: string;
  name: string;
  location?: string;
  enabled: boolean;
  url: string;
  scan_count: number;
  unique_count: number;
  ios_count: number;
  android_count: number;
  other_count: number;
  bot_count: number;
}

export interface QrAnalytics {
  campaign_id: string;
  total_scans: number;
  total_unique: number;
  total_ios: number;
  total_android: number;
  total_other: number;
  placements: QrPlacementAnalytics[];
  daily: QrDailyBucket[];
}

export interface CreateCampaignRequest {
  name: string;
  description?: string;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  enabled?: boolean;
}

export interface AddPlacementRequest {
  name: string;
  location?: string;
}

export interface UpdatePlacementRequest {
  name?: string;
  location?: string;
  enabled?: boolean;
}
