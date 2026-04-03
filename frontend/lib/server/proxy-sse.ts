/**
 * Proxy Server-Sent Events from the FastAPI pipeline to the browser.
 *
 * - Non-OK upstream responses are returned as JSON (never mislabeled as SSE).
 * - OK streams are wrapped so Undici "terminated" / socket errors during read
 *   become a final SSE error event instead of an unhandled 500 on the Next route.
 */

const SSE_STREAM_INTERRUPTED_MSG =
  "Stream to the pipeline was interrupted (the server closed the connection). " +
  "If you restarted the pipeline, hit save/reload, or the job expired, run this step again.";

function wrapSseUpstreamBody(
  body: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const encoder = new TextEncoder();
  const errorLine = `data: ${JSON.stringify({
    type: "error",
    message: SSE_STREAM_INTERRUPTED_MSG,
  })}\n\n`;

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch {
        try {
          controller.enqueue(encoder.encode(errorLine));
        } catch {
          /* stream already closed */
        }
        try {
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });
}

export async function proxySse(
  targetUrl: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<Response> {
  const method = init.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD" && init.body != null;

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...(init.headers ?? {}),
      },
      body: hasBody ? init.body : undefined,
      cache: "no-store",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Upstream connection failed";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    let message = `Pipeline returned ${upstream.status}`;
    try {
      const j = JSON.parse(text) as { detail?: unknown; error?: unknown };
      const d = j.detail;
      const e = j.error;
      if (typeof d === "string") message = d;
      else if (Array.isArray(d) && d[0] && typeof (d[0] as { msg?: string }).msg === "string") {
        message = (d[0] as { msg: string }).msg;
      } else if (typeof e === "string") message = e;
    } catch {
      if (text?.trim()) message = text.slice(0, 500);
    }
    return new Response(
      JSON.stringify({ error: message, status: upstream.status }),
      {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (!upstream.body) {
    return new Response(
      JSON.stringify({ error: "Upstream returned no response body" }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  return new Response(wrapSseUpstreamBody(upstream.body), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
