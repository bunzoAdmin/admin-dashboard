# Assign rider on the order page

**Date:** 2026-11-13
**Status:** Approved in chat, implementing

## Summary

Force-assign of a pooled order moves from the sidebar **Assign Order** page onto the order detail header, beside Advance, Batch, and Cancel. The sidebar page and its nav item go away.

Assign still means `POST /admin/assign`: the live trip must be `created`, and the rider must be `eligible`. It sets that trip to `accepted` and the rider to busy. It does not change the order status, and the order page does not show who the rider is afterward.

## Button

**Assign rider** is a primary header button. It renders only when both are true:

- The order status is not `DELIVERED` or `CANCELLED`.
- The live trip for this order number (the trip `POST /admin/assign` uses) has status `created`.

If the live-trip request fails, or there is no live trip, the button stays hidden.

The day-legs endpoint `GET /admin/trips/by-orders` is the wrong signal. It prefers a completed trip.

## Live trip read

`GET /api/v1/admin/orders/{orderId}/live-trip` (admin auth).

200:

```json
{ "order_id": "ORD1", "trip_id": "t1", "status": "created", "store_id": "221" }
```

- Missing order id: 400 `MISSING_PARAM`
- No live trip: 404 `NO_LIVE_TRIP`
- Lookup error: 500 `LIVE_TRIP_FETCH_FAILED`

`store_id` is the darkstore id on the trip. The rider list uses that id, not a separately guessed store.

## Modal

Clicking the button opens a confirm modal titled **Assign rider**.

The dropdown lists riders whose `assigned_store_id` is the trip’s `store_id` and whose status is `eligible`. Pages of `GET /admin/drivers` are walked until `next_cursor` is empty or repeats, with a cap of 20 pages. Each option is `Name — phone`. Status and cash are not shown.

Confirm is labeled **Assign** and stays disabled while the list is loading, when the load fails, when the list is empty, and until a rider is selected. An empty list says “No eligible riders at this store.” A trip with no store id says “This trip has no store.”

Confirm calls `POST /admin/assign` with this order number and the selected phone. A failed assign stays in the modal with the error, and the operator can try again. Success closes the modal, toasts `Order assigned to {name}.`, and hides the button. The order status is left as it was.

## Removal

- Delete the **Assign Order** item from the Orders nav.
- Delete `/orders/assign` and the `/assign` redirect to it.
