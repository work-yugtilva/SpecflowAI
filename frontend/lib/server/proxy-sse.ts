import http, { type RequestOptions } from "node:http";
import https from "node:https";
import { Readable } from "node:stream";

function pickTransport(protocol: string) {
  if (protocol === "https:") return https;
  if (protocol === "http:") return http;
  throw new Error(`Unsupported SSE protocol: ${protocol}`);
}

export async function proxySse(
  targetUrl: string,
  init: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<Response> {
  const url = new URL(targetUrl);
  const transport = pickTransport(url.protocol);

  return new Promise<Response>((resolve, reject) => {
    const options: RequestOptions = {
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: init.method ?? "GET",
      headers: {
        Accept: "text/event-stream",
        "Cache-Control": "no-cache",
        ...(init.headers ?? {}),
      },
    };

    const request = transport.request(options, (upstream) => {
      const body =
        upstream.statusCode === 204 || !upstream.readable
          ? null
          : (Readable.toWeb(upstream) as ReadableStream<Uint8Array>);

      resolve(
        new Response(body, {
          status: upstream.statusCode ?? 502,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
          },
        })
      );
    });

    request.on("error", reject);

    if (init.body) {
      request.write(init.body);
    }

    request.end();
  });
}
