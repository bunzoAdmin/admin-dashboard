# Delivery batching — admin-dashboard (Design)

**Date:** 2026-11-10
**Status:** Pending review
**Scope:** admin-dashboard only. qcom owns merge writes. Companion: `qcom/docs/superpowers/specs/2026-11-10-delivery-batching-qcom-design.md`.

## Summary

Order detail gets a **Batch** button. It lists same-store riders who already have a live trip (**name + phone**). Confirm is **Are you sure?** plus a one-liner when the click steals the order off another rider and/or the target will exceed the cash cap. Old driver app is a **hard refuse**, not a warning.

Ops does not pick sequences, km, or SLA on this screen. qcom copies tasks with status, orders pickups by merge order, and NN-sorts drops.

The order page’s existing pickup-complete and mark-delivered actions stay **this order**. The driver profile **Current trip** card must stop assuming one pickup and one drop. Reassign still moves the **whole** trip.

`batched_order` as an admin drop **reason** stays as a weird-case label. It is not how you batch.

## Goals

- From `/orders/[orderNumber]`, batch this order onto a busy same-store rider.
- List: name + phone only.
- Confirm: generic + split/cash one-liners; disable/refuse old app using `app_ok`.
- Hide the button when qcom says batching is off (`403 BATCHING_DISABLED`) or the order is not batchable.
- Current-trip admin actions work on a chosen **task**, not `tasks.find(pickup)` / `find(drop)`.
- Trip history does not treat `inactive` as customer-cancelled or as paid.

## Non-Goals

- Tour map, pickup/drop sequence preview, SLA table on confirm (ops chose minimal UI).
- Batching idle/eligible riders (that is **Assign Order**).
- Cross-store list.
- Changing Reassign into steal-one-order.
- order-service UI (picker, invoices) beyond showing the order’s own Java status, which already updates per order.
- Removing the `batched_order` drop-reason enum value.

## Where the button lives

`admin-dashboard/src/app/orders/[orderNumber]/page.tsx`

Show **Batch** when:

- Order Java status is not `CANCELLED` or `DELIVERED`.
- Candidates GET succeeded (not `403 BATCHING_DISABLED`).
- The order is not already the only work on a rider you would batch onto itself (server excludes that rider; if the list is empty, still show the button disabled with “No riders on a live trip at this store.”).

Do not wait for a qcom trip to exist. Confirming an order with no trip is valid; qcom synthesizes pickup+drop.

## APIs

Add to `src/lib/api.ts` (admin JWT, same `request` helper as drop preview).

### Candidates

`GET /admin/orders/{orderNumber}/batch/candidates`

```ts
export interface BatchCandidate {
  phone: string;
  name: string;
  trip_id: string;
  trip_updated_at: string;
  app_ok: boolean;
  cash_exceeds: boolean;
}

export interface BatchCandidatesResponse {
  source_trip_id?: string;
  source_trip_updated_at?: string;
  source_rider_name?: string;
  candidates: BatchCandidate[];
}
```

`403` `{ error: { code: "BATCHING_DISABLED" } }` → hide Batch for everyone until the flag is on.

### Confirm

`POST /admin/orders/{orderNumber}/batch`

```ts
export interface BatchOrderBody {
  target_de_phone: string;
  expected_updated_at: Record<string, string>; // trip_id → trip_updated_at
}

export interface BatchOrderResponse {
  trip_id: string;
  order_ids: string[];
  status: string;
  distance_method: 'google' | 'haversine';
  warnings?: Array<'cash_exceeds' | 'haversine_fallback'>;
}
```

`expected_updated_at` **must** include the selected candidate’s `trip_id` → `trip_updated_at`. If the response has `source_trip_id`, also send `source_trip_id` → `source_trip_updated_at`. Do not invent timestamps. On `409 STALE_MERGE`, refetch candidates and retry.

## List UI

Modal or panel. One row per candidate with `app_ok === true`: **name**, **phone**.

Candidates with `app_ok === false`: do not select. Either omit them or show name + phone + disabled + “App too old”. Preferred: show them disabled so ops understands why the rider is missing from the live set.

No trip status, no order ids, no cash column, no map.

## Confirm UI

Primary: **Are you sure?**

Extra lines, only when true for the **selected** candidate:

- If `source_rider_name` is set: `This takes the order off {source_rider_name}.`
- If the **selected** candidate has `cash_exceeds`: `This rider will exceed the cash cap.`

No line for haversine. `distance_method` on the 200 may be toasted optionally (`Batched (walking-distance fallback)`) — not required.

Old app: never in this confirm; those rows are not selectable. If POST still returns `409 APP_TOO_OLD`, toast that and refresh the list.

Buttons: Cancel / Batch.

On `409 STALE_MERGE`: toast “Trip changed, pick again”, close confirm, refetch candidates.

On success: toast “Batched”, refresh the order (Java status unchanged unless you also completed something), close modal.

## Types

`src/lib/types.ts`:

- `TripStatus` add `'inactive'`.
- `Trip` add optional `order_ids?: string[]`, `superseded_by_trip_id?: string`, `supersedes_trip_ids?: string[]`, `distance_method?: string`.
- `TripTask` add optional `order_id?: string`, `otp?: string`, `delivery_zone?: string`, `items?: TripItem[]`, `payment?: TripPayment`, `drop_deadline?: number`, `reached_at?: string`.

Do not break existing singleton rendering if those fields are absent.

## Current trip card (driver profile)

File: `src/components/driver/CurrentTripCard.tsx`

Today:

```ts
const pickup = trip?.tasks.find((t) => t.type === 'pickup');
const drop = trip?.tasks.find((t) => t.type === 'drop');
```

That completes the **wrong** order on a batch.

Change:

- List every task (type, order_id, status).
- “Mark pickup complete” / “Mark drop complete” run against a **selected** open pickup/drop `task_id`, **or** call the **order-scoped** admin endpoints (`/admin/orders/{orderId}/pickup/complete` and drop complete) with the task’s `order_id`.
- Prefer order-scoped endpoints when `task.order_id` is set — they are the contract for “this order only”.
- Reassign stays trip-scoped (`/admin/trips/{trip_id}/reassign`). Copy: it moves **all** orders on this trip. Do not add a second steal control here (Batch on the order page is steal).

`canMarkPickup`: trip `accepted` and the selected/target pickup is not completed.
`canMarkDrop`: trip `out_for_delivery` and the selected drop is not completed.

If multiple open pickups exist, do not enable a single unlabeled button.

## Order page pickup / mark delivered

Keep using `/admin/orders/{orderNumber}/pickup/complete` and drop complete. qcom will target **this** order’s tasks on the live (possibly batched) trip. No dashboard change to *which* URL; only ensure you still pass this `orderNumber`, not the driver’s “first drop”.

Drop reason `batched_order` remains in `ADMIN_DROP_REASONS` for odd completions. It is not required to batch.

## Trip history / earnings / legs

`inactive` trips:

- Badge label **Inactive** (not Cancelled, not Completed).
- Exclude from earnings totals (qcom should already omit payout; don’t display them as paid if a payout object is empty).
- Legs / trips-by-orders: follow qcom; if an `inactive` trip appears, prefer the successor (`superseded_by_trip_id`) or ignore for km.

`src/lib/tripTiming.ts` and `orderLegsView` must not treat `inactive` as `cancelled`.

## Assign Order page

Unchanged. Still pooled trip → eligible idle rider. Do not list busy riders there.

## Testing (dashboard)

- Flag off: Batch hidden (candidates 403).
- Flag on, no busy riders at store: empty list copy.
- Select rider, no `source_rider_name`, cash ok: confirm is only Are you sure?
- `source_rider_name` set: split one-liner visible.
- `cash_exceeds`: cash one-liner; confirm still enabled.
- `app_ok: false`: cannot submit.
- POST 409 STALE_MERGE: list refreshes, no success toast.
- POST 200: modal closes, order page reloads.
- CurrentTripCard with 4 tasks: cannot mark the first completed pickup again; can mark the open pickup; drop buttons disabled until trip is OFD.
- Reassign copy visible; still one trip_id.
- `inactive` in driver trips tab is not red-cancelled.
