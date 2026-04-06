/**
 * Parse Server-Sent Events (data: JSON lines) from a ReadableStream.
 * Buffers incomplete lines across chunks — required for long JSON payloads.
 */

export async function* iterateSseJsonLines<T = unknown>(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        throw e;
      }
      const { done, value } = chunk;
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            yield JSON.parse(line.slice(6)) as T;
          } catch {
            // skip malformed SSE line
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
