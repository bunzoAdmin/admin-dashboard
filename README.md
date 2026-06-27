# Bunzo Admin Dashboard

Internal operations console for Bunzo. Next.js 15 (App Router) + TypeScript + Tailwind.

- **qcom** (`NEXT_PUBLIC_API_BASE_URL`) — admin auth, riders, orders, disputes
- **product-service** (`NEXT_PUBLIC_CATALOG_API_BASE_URL`) — catalog categories and products

## Stack

- Next.js 15 / React 19
- TypeScript, Tailwind CSS
- zustand (auth state), lucide-react (icons), clsx

## Auth

Username/password login against qcom. JWT is stored client-side and sent as `Authorization: Bearer` on admin API calls.

## Setup (local)

```bash
cp .env.example .env
# Edit .env — set NEXT_PUBLIC_CATALOG_API_BASE_URL to your inventory host
npm install
npm run dev                 # http://localhost:3100
```

## Environment variables

| Name | Description |
|------|-------------|
| `NEXT_PUBLIC_API_BASE_URL` | qcom admin API base URL |
| `NEXT_PUBLIC_CATALOG_API_BASE_URL` | product-service host for `/api/v1/catalog/*` |
| `NEXT_PUBLIC_DEFAULT_STORE_ID` | Default store for product sync (optional, default `1`) |

## Navigation

| Section | Routes |
|---------|--------|
| Home | `/` |
| Orders | `/orders/disputes`, `/orders/assign` |
| Riders | `/riders`, `/riders/onboard`, `/riders/payout-rules` |
| Catalog | `/catalog/categories`, `/catalog/products`, `/catalog/products/browse` |
| Stores | `/stores/qr` |
| Settings | `/settings/users` |

Legacy flat URLs (`/drivers`, `/disputes`, etc.) redirect to the new paths.

## Features

- **Disputes** — triage customer disputes with order evidence and status actions
- **Riders** — lookup, onboard, trip overview, earnings, cash, disbursements, referrals
- **Payout rules** — rate modifier / accumulator / ranking editor with version history
- **Assign order** — force-assign pooled orders to on-duty drivers
- **Categories** — category tree view and create root/subcategory
- **Products** — barcode scan → lookup → create or edit via sync API
- **Store QR** — hourly duty QR display for darkstores
- **Admin users** — create admins and reset passwords

## Scripts

- `npm run dev` – local dev server
- `npm run build` / `npm run start` – production build & serve
- `npm run typecheck` – `tsc --noEmit`
- `npm run lint`

## Deploy on Vercel

Set all `NEXT_PUBLIC_*` env vars in **Project → Settings → Environment Variables**. Ensure CORS on both qcom and product-service allows your dashboard origin.
