import { readFile, writeFile, mkdir, rename, readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { get, put } from "@vercel/blob";
import { BadRequest, UpstreamError } from "#server/core/errors.ts";

export const INDEX_MAX_BYTES = 16 * 1024 * 1024;
const TTL = 7 * 86_400_000;
/** JSON bytes keyed by Belfiore. Freshness and size bounds apply on every backend. */
export interface CadastralStorage {
  get(belfiore: string): Promise<Uint8Array | undefined>;
  put(belfiore: string, bytes: Uint8Array): Promise<void>;
}
function validCode(code: string) {
  if (!/^[A-Z]\d{3}$/.test(code)) throw new BadRequest("Codice Belfiore non valido.");
  return code;
}
function validSize(bytes: Uint8Array) {
  if (bytes.byteLength > INDEX_MAX_BYTES)
    throw new UpstreamError("Indice comunale oltre il limite di 16 MiB.");
}
export class DiskCadastralStorage implements CadastralStorage {
  private readonly root: string;
  constructor(
    root = process.env.PARTICELLA_CADASTRAL_INDEX_DIR ?? join(tmpdir(), "particella-cadastral-index-v1"),
  ) {
    this.root = root;
  }
  async get(code: string) {
    const path = join(this.root, `${validCode(code)}.json`);
    try {
      const info = await stat(path);
      if (info.size > INDEX_MAX_BYTES || Date.now() - info.mtimeMs >= TTL) return undefined;
      const bytes = await readFile(path);
      validSize(bytes);
      return bytes;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }
  async put(code: string, bytes: Uint8Array) {
    validCode(code);
    validSize(bytes);
    await mkdir(this.root, { recursive: true });
    const files = await Promise.all(
      (await readdir(this.root))
        .filter((n) => /^[A-Z]\d{3}\.json$/.test(n))
        .map(async (name) => ({ name, info: await stat(join(this.root, name)).catch(() => undefined) })),
    );
    let size = files.reduce((s, f) => s + (f.info?.size ?? 0), 0);
    for (const f of files.sort((a, b) => (a.info?.mtimeMs ?? 0) - (b.info?.mtimeMs ?? 0))) {
      if (size + bytes.byteLength <= 256 * 1024 * 1024) break;
      await unlink(join(this.root, f.name)).catch((e: NodeJS.ErrnoException) => {
        if (e.code !== "ENOENT") throw e;
      });
      size -= f.info?.size ?? 0;
    }
    const temporary = join(this.root, `${code}-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, bytes, { flag: "wx" });
      await rename(temporary, join(this.root, `${code}.json`));
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
}

/** Inject the two SDK functions to exercise private reads/writes without credentials or networking. */
export class BlobCadastralStorage implements CadastralStorage {
  private readonly token: string;
  private readonly sdk: { get: typeof get; put: typeof put };
  constructor(token: string, sdk = { get, put }) {
    this.token = token;
    this.sdk = sdk;
  }
  private path(code: string) {
    return `cadastral-index/v1/${validCode(code)}.json`;
  }
  async get(code: string) {
    const result = await this.sdk.get(this.path(code), {
      access: "private",
      token: this.token,
      useCache: false,
    });
    if (!result || result.statusCode !== 200) return undefined;
    if (Date.now() - result.blob.uploadedAt.getTime() >= TTL) {
      await result.stream.cancel();
      return undefined;
    }
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > INDEX_MAX_BYTES) throw new UpstreamError("Indice Blob oltre il limite di 16 MiB.");
        chunks.push(value);
      }
      return Buffer.concat(chunks, length);
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }
  async put(code: string, bytes: Uint8Array) {
    validSize(bytes);
    await this.sdk.put(this.path(code), Buffer.from(bytes), {
      access: "private",
      token: this.token,
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
    });
  }
}
export function cadastralStorage(): CadastralStorage {
  return process.env.BLOB_READ_WRITE_TOKEN
    ? new BlobCadastralStorage(process.env.BLOB_READ_WRITE_TOKEN)
    : new DiskCadastralStorage();
}
