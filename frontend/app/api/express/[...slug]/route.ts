import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolveExpressUpstreamBase } from "@/lib/server/express-upstream";

export const runtime = "nodejs";

const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept"];

function buildUpstreamUrl(slug: string[], search: string): string {
  const base = resolveExpressUpstreamBase();
  const path = slug.join("/");
  return `${base}/${path}${search}`;
}

function forwardRequestHeaders(incoming: Headers): Headers {
  const out = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value) out.set(name, value);
  }
  return out;
}

async function handle(req: NextRequest, context: { params: { slug: string[] } }): Promise<Response> {
  const slug = context.params.slug;
  if (!slug?.length) {
    return NextResponse.json({ success: false, error: "Missing path after /api/express" }, { status: 400 });
  }

  const target = buildUpstreamUrl(slug, req.nextUrl.search);

  const init: RequestInit = {
    method: req.method,
    headers: forwardRequestHeaders(req.headers),
    redirect: "manual",
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upstream fetch failed";
    return NextResponse.json(
      { success: false, error: `Express proxy could not reach upstream: ${message}` },
      { status: 502 }
    );
  }

  const headers = new Headers(upstream.headers);
  headers.delete("transfer-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export async function GET(req: NextRequest, context: { params: { slug: string[] } }) {
  return handle(req, context);
}

export async function POST(req: NextRequest, context: { params: { slug: string[] } }) {
  return handle(req, context);
}

export async function DELETE(req: NextRequest, context: { params: { slug: string[] } }) {
  return handle(req, context);
}

export async function PUT(req: NextRequest, context: { params: { slug: string[] } }) {
  return handle(req, context);
}

export async function PATCH(req: NextRequest, context: { params: { slug: string[] } }) {
  return handle(req, context);
}
