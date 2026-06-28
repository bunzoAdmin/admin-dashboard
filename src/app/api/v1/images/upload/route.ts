import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CATALOG_HOST = (process.env.CATALOG_PROXY_TARGET ?? 'http://localhost:8081').replace(/\/$/, '');

/**
 * Proxies multipart image uploads to product-service.
 * Vercel rewrites corrupt multipart bodies for external POST — this route forwards the raw body.
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ message: 'Expected multipart/form-data upload' }, { status: 400 });
  }

  const target = `${CATALOG_HOST}/api/v1/images/upload${req.nextUrl.search}`;

  let body: ArrayBuffer;
  try {
    body = await req.arrayBuffer();
  } catch {
    return NextResponse.json({ message: 'Failed to read upload body' }, { status: 400 });
  }

  if (body.byteLength === 0) {
    return NextResponse.json({ message: 'Upload body is empty' }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': contentType },
      body
    });
  } catch {
    return NextResponse.json({ message: 'Could not reach product-service for image upload' }, { status: 502 });
  }

  const responseText = await upstream.text();
  return new NextResponse(responseText, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
    }
  });
}
