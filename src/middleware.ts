import { NextRequest, NextResponse } from 'next/server';

/**
 * Optional site-wide gate for production (Vercel Hobby-friendly).
 * Set ADMIN_SITE_PASSWORD in Vercel env vars — the browser prompts once,
 * then a cookie keeps the gate open so app Bearer tokens still work on /api/*.
 *
 * Leave unset locally so `npm run dev` works without an extra prompt.
 */
const SITE_USER = process.env.ADMIN_SITE_USER ?? 'bunzo';
const SITE_PASSWORD = process.env.ADMIN_SITE_PASSWORD;
const GATE_COOKIE = 'bunzo_admin_gate';

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function gateToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`bunzo-admin-gate:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseBasicAuth(header: string | null): { user: string; pass: string } | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = atob(header.slice(6));
    const colon = decoded.indexOf(':');
    if (colon < 0) return null;
    return { user: decoded.slice(0, colon), pass: decoded.slice(colon + 1) };
  } catch {
    return null;
  }
}

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return res;
}

export async function middleware(req: NextRequest) {
  if (!SITE_PASSWORD) {
    return withSecurityHeaders(NextResponse.next());
  }

  const expected = await gateToken(SITE_PASSWORD);
  const cookie = req.cookies.get(GATE_COOKIE)?.value;
  if (cookie && timingSafeEqual(cookie, expected)) {
    return withSecurityHeaders(NextResponse.next());
  }

  const basic = parseBasicAuth(req.headers.get('authorization'));
  const basicOk =
    basic !== null && timingSafeEqual(basic.user, SITE_USER) && timingSafeEqual(basic.pass, SITE_PASSWORD);

  if (!basicOk) {
    return new NextResponse('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Bunzo Admin", charset="UTF-8"' }
    });
  }

  const res = withSecurityHeaders(NextResponse.next());
  res.cookies.set(GATE_COOKIE, expected, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)']
};
