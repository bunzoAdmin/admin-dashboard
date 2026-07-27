export type OrderAnalyticsPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export interface DeliveredOrderInsight {
  orderNumber: string;
  deliveredAt?: string;
  endToEndSeconds: number;
  gmv: number;
  withinSla: boolean;
  secondsOverSla: number;
}

export interface OrderAnalyticsResponse {
  storeId: number;
  period: OrderAnalyticsPeriod;
  fromDate: string;
  toDate: string;
  periodLabel: string;
  rangeStart?: string;
  rangeEnd?: string;
  slaMinutes: number;
  overview: {
    placedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    cancelRatePercent?: number | null;
    gmv: number;
    aov?: number | null;
    avgEndToEndSeconds?: number | null;
    withinSlaPercent?: number | null;
    withinSlaCount: number;
    fastestEndToEndSeconds?: number | null;
    slowestEndToEndSeconds?: number | null;
  };
  stageAverages: {
    avgPlacedToConfirmedSeconds?: number | null;
    avgConfirmedToPackingSeconds?: number | null;
    avgPackingToReadySeconds?: number | null;
    avgReadyToOutSeconds?: number | null;
    avgOutToDeliveredSeconds?: number | null;
  };
  dailyTrend: Array<{
    date: string;
    placed: number;
    delivered: number;
    cancelled: number;
  }>;
  slaBreaches: DeliveredOrderInsight[];
  slowestDeliveries: DeliveredOrderInsight[];
  fastestDeliveries: DeliveredOrderInsight[];
}
