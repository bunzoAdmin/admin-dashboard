export interface AssignRiderOption {
  name: string;
  phone: string;
}

export function showAssignRider(
  orderStatus: string,
  liveTrip: { status: string } | null
): boolean {
  if (orderStatus === 'DELIVERED' || orderStatus === 'CANCELLED') return false;
  return liveTrip?.status === 'created';
}

export function eligibleAssignRiders(
  drivers: { name: string; phone_number: string; status: string }[]
): AssignRiderOption[] {
  return drivers
    .filter((d) => d.status === 'eligible')
    .map((d) => ({ name: d.name, phone: d.phone_number }));
}

export function canConfirmAssignRider(opts: {
  selectedPhone: string;
  loading: boolean;
  error: string | null;
  riderCount: number;
}): boolean {
  return (
    !opts.loading &&
    !opts.error &&
    opts.riderCount > 0 &&
    opts.selectedPhone.trim() !== ''
  );
}
