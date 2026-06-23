# Bunzo Admin Dashboard

Internal admin dashboard for Bunzo driver operations. Next.js 15 (App Router) + TypeScript + Tailwind, talking directly to the `qcom` backend.

## Stack

- Next.js 15 / React 19
- TypeScript, Tailwind CSS
- zustand (auth state), lucide-react (icons), clsx

## Auth model

A single shared **admin key** gates every backend call. On login the key is stored
client-side and sent as the `X-Admin-Key` header on direct requests to `qcom`. There
are no per-person accounts; the optional "your name" field is sent as `X-Admin-Label`
for loose attribution in server logs. Admin actions are audited via qcom's structured logs.

## Setup (local)

```bash
cp .env.example .env
npm install
npm run dev                 # http://localhost:3100 (not 3000 — that's BunzoWeb)
```

The backend must run with the `ADMIN_KEY` env var set; use that same value to log in.

## Deploy on Vercel (free tier)

This app is a standard Next.js 15 project — Vercel is the simplest host.

### Option A — Vercel dashboard (recommended)

1. Push `admin-dashboard` to its own GitHub repo (or connect the monorepo and set **Root Directory** to `admin-dashboard`).
2. Go to [vercel.com/new](https://vercel.com/new) → Import the repo.
3. **Framework preset:** Next.js (auto-detected).
4. **Environment variable** (Production + Preview):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_API_BASE_URL` | `https://api.bunzodelivery.com` |

5. Deploy. Vercel gives you a URL like `https://bunzo-admin-dashboard.vercel.app`.

Optional: add a custom domain under **Project → Settings → Domains** (e.g. `admin.bunzodelivery.com`).

### Option B — Vercel CLI

From this folder:

```bash
npm i -g vercel          # or: npx vercel
vercel login
vercel --prod
```

When prompted for env vars, add `NEXT_PUBLIC_API_BASE_URL=https://api.bunzodelivery.com`, or set it in the Vercel dashboard after the first deploy.

### After deploy

- Log in with the same `ADMIN_KEY` configured on `api.bunzodeliver.com`.
- CORS on qcom must allow your Vercel origin (`Access-Control-Allow-Origin: *` already works).
- Do **not** commit `.env` — only set secrets in Vercel **Project → Settings → Environment Variables**.

## Scripts

- `npm run dev` – local dev server
- `npm run build` / `npm run start` – production build & serve
- `npm run typecheck` – `tsc --noEmit`
- `npm run lint`

## Features

- **Drivers** – look up a driver by phone; aggregated detail with Overview, Earnings,
  Disbursements, Cash, and Referrals tabs.
- **Onboard driver** – create a driver and upload profile / NRC / license docs
  directly to S3 via admin-presigned URLs.
- **Assign order** – force-assign a pooled order to an on-duty driver.
- **Cash & disbursement** – record COD cash deposits and weekly payouts from the
  driver detail page.
- **Payout rules** – guided per-family editor (rate modifier / accumulator / ranking)
  with enable/disable and version history.

## Backend endpoints used (`qcom`, all under `/api/v1/admin`, `X-Admin-Key` required)

`GET /drivers/{phone}`, `GET /drivers/{phone}/{earnings|disbursements|referrals|cash-ledger}`,
`POST /uploads/url`, `POST /drivers`, `POST /assign`,
`POST /de/{phone}/cash-deposit`, `POST /de/{deId}/disbursement`,
`GET|POST /rules`, `GET /rules/{id}/versions`, `PUT|DELETE /rules/{id}`.
