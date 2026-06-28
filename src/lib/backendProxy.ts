import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const CATALOG_HOST = (process.env.CATALOG_PROXY_TARGET ?? 'http://localhost:8081').replace(/\/$/, '');
const ORDER_HOST = (process.env.ORDER_PROXY_TARGET ?? 'http://localhost:8082').replace(/\/$/, '');

const FORWARD_REQUEST_HEADERS = ['authorization', 'idempotency-key', 'accept'];

function buildTargetUrl(basePath: string, pathSegments: string[] | undefined, search: string): string {
  const host = basePath.startsWith('/api/v1/admin/picker') ? ORDER_HOST : CATALOG_HOST;
  const suffix = pathSegments?.length ? `/${pathSegments.join('/')}` : '';
  return `${host}${basePath}${suffix}${search}`;
}

function forwardHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

async function proxy(req: NextRequest, basePath: string, pathSegments?: string[]): Promise<NextResponse> {
  const target = buildTargetUrl(basePath, pathSegments, req.nextUrl.search);

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.arrayBuffer();
    } catch {
      return NextResponse.json({ message: 'Failed to read request body' }, { status: 400 });
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: forwardHeaders(req),
      body: body && body.byteLength > 0 ? body : undefined
    });
  } catch {
    return NextResponse.json({ message: 'Could not reach backend service' }, { status: 502 });
  }

  const responseText = await upstream.text();
  return new NextResponse(responseText, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json'
    }
  });
}

type RouteContext = { params: Promise<{ path?: string[] }> };

function handlers(basePath: string) {
  async function run(req: NextRequest, context: RouteContext) {
    const { path } = await context.params;
    return proxy(req, basePath, path);
  }
  return {
    GET: run,
    POST: run,
    PUT: run,
    PATCH: run,
    DELETE: run
  };
}

export const catalogProxy = handlers('/api/v1/catalog');
export const inventoryProxy = handlers('/api/v1/inventory');
export const storesProxy = handlers('/api/v1/admin/stores');
export const pickerProxy = handlers('/api/v1/admin/picker');
export const imagesProxy = handlers('/api/v1/images');
