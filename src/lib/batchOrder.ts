import type { BatchCandidate, BatchCandidatesResponse } from './types';

export function isBatchingDisabledError(err: unknown): boolean {
  return isApiError(err, 403, 'BATCHING_DISABLED');
}

export function isStaleMergeError(err: unknown): boolean {
  return isApiError(err, 409, 'STALE_MERGE');
}

export function isAppTooOldError(err: unknown): boolean {
  return isApiError(err, 409, 'APP_TOO_OLD');
}

export function buildBatchExpectedUpdatedAt(
  candidate: Pick<BatchCandidate, 'trip_id' | 'trip_updated_at'>,
  source?: Pick<BatchCandidatesResponse, 'source_trip_id' | 'source_trip_updated_at'>
): Record<string, string> {
  const expected: Record<string, string> = {
    [candidate.trip_id]: candidate.trip_updated_at
  };
  if (source?.source_trip_id && source.source_trip_updated_at) {
    expected[source.source_trip_id] = source.source_trip_updated_at;
  }
  return expected;
}

function isApiError(err: unknown, status: number, code: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const rec = err as { status?: unknown; code?: unknown };
  return rec.status === status && rec.code === code;
}
