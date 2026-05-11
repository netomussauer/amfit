// Catch-all proxy server-side de /api/v1/* para o backend Go.
//
// Por que existe: o api-client do browser usa baseURL relativa (`/api/v1`)
// para evitar CORS e nao expor a URL do backend. Esse route handler roda no
// servidor Next.js e encaminha tudo para o backend usando API_ORIGIN (cluster-
// internal em prod; localhost em dev). Tentamos `next.config.mjs > rewrites()`
// primeiro, mas o array de rewrites nao aparecia em routes-manifest.json com
// Next 14.2.5 + output:'standalone' — esse handler e o caminho explicito.
//
// Forwarding:
// - Preserva metodo, query string, body, headers (menos host/connection).
// - Devolve status e body do backend sem alteracoes.

import { NextRequest, NextResponse } from 'next/server';

const API_ORIGIN =
  process.env.API_ORIGIN ?? 'http://localhost:8080';

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
]);

async function proxy(
  req: NextRequest,
  ctx: { params: { path: string[] } },
): Promise<NextResponse> {
  const path = ctx.params.path.join('/');
  const target = `${API_ORIGIN}/api/v1/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.arrayBuffer();
  }

  let backend: Response;
  try {
    backend = await fetch(target, init);
  } catch (err) {
    return NextResponse.json(
      { error: 'upstream_unreachable', detail: String(err) },
      { status: 502 },
    );
  }

  const respHeaders = new Headers();
  backend.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      respHeaders.set(key, value);
    }
  });

  return new NextResponse(backend.body, {
    status: backend.status,
    headers: respHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
export const HEAD = proxy;

export const dynamic = 'force-dynamic';
