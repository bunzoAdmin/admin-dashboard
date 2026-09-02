import type { OrderStatus } from './orderAdminTypes';

export type OrderStatusAdvanceAction = 'qcom-pickup' | 'qcom-drop' | 'java';

export function orderStatusAdvanceAction(target: OrderStatus): OrderStatusAdvanceAction {
  if (target === 'OUT_FOR_DELIVERY') return 'qcom-pickup';
  if (target === 'DELIVERED') return 'qcom-drop';
  return 'java';
}

export function showStatusAdvanceNotes(target: OrderStatus): boolean {
  return orderStatusAdvanceAction(target) === 'java';
}
