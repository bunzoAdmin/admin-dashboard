export function canConfirmAdminDrop(mode: string, selectedPhone: string): boolean {
  if (mode === 'blocked' || mode === 'already_done') return false;
  if (mode === 'pick_rider') return Boolean(selectedPhone);
  return mode === 'java_only' || mode === 'force_progress';
}

export function adminDropConfirmLabel(mode: string): string {
  switch (mode) {
    case 'java_only': return 'Mark delivered (no trip)';
    case 'pick_rider': return 'Assign and mark delivered';
    case 'force_progress': return 'Mark delivered';
    default: return 'Confirm';
  }
}
