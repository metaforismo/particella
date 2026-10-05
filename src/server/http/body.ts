import { BadRequest } from "#server/core/errors.ts";

export async function boundedJson(request: Request, limit = 65_536): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new BadRequest("Corpo della richiesta mancante.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new BadRequest("La conversazione è troppo lunga.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new BadRequest("JSON della richiesta non valido.");
  }
}
