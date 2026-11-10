export function canAdminMarkPickup(
  tripStatus: string,
  task: { type: string; status: string }
): boolean {
  return tripStatus === 'accepted' && task.type === 'pickup' && task.status !== 'completed';
}

export function canAdminMarkDrop(
  tripStatus: string,
  task: { type: string; status: string }
): boolean {
  return tripStatus === 'out_for_delivery' && task.type === 'drop' && task.status !== 'completed';
}
