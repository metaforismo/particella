import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, utimes } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { GetBlobResult, PutBlobResult } from "@vercel/blob";
import {
  BlobCadastralStorage,
  DiskCadastralStorage,
  INDEX_MAX_BYTES,
  type CadastralStorage,
} from "#server/countries/it/cadastral-storage.ts";
import {
  loadCadastralIndex,
  storeCadastralIndex,
  buildCadastralIndex,
} from "#server/countries/it/cadastral-index.ts";
import { DEFAULT_BELFIORE, prebuildCadastre } from "../scripts/cadastre-prebuild.ts";
import { readFile } from "node:fs/promises";

const index = await buildCadastralIndex(
  new Uint8Array(await readFile(new URL("./fixtures/cadastral-search-window.zip", import.meta.url))),
  "A564",
  { requestUrl: "https://official.test/archive.zip", retrievedAt: new Date().toISOString() },
);
class FakeStorage implements CadastralStorage {
  entries = new Map<string, Uint8Array>();
  async get(code: string) {
    return this.entries.get(code)?.slice();
  }
  async put(code: string, bytes: Uint8Array) {
    this.entries.set(code, bytes.slice());
  }
}
test("index persists through get/put and a new reader; corrupt, wrong municipality and storage outage stay distinct", async () => {
  const storage = new FakeStorage();
  await storeCadastralIndex(index, storage);
  assert.deepEqual(await loadCadastralIndex("A564", storage), index);
  storage.entries.set("D612", storage.entries.get("A564")!);
  assert.equal(await loadCadastralIndex("D612", storage), undefined);
  storage.entries.set("A564", new TextEncoder().encode("invalid JSON"));
  assert.equal(await loadCadastralIndex("A564", storage), undefined);
  await assert.rejects(
    loadCadastralIndex("A564", {
      ...storage,
      get: async () => {
        throw new Error("storage unavailable");
      },
      put: storage.put.bind(storage),
    }),
    /storage unavailable/,
  );
});
test("disk storage is optional, bounded, expires after seven days and rejects path traversal", async () => {
  const directory = await mkdtemp(join(tmpdir(), "particella-f-storage-"));
  try {
    const storage = new DiskCadastralStorage(directory);
    await storeCadastralIndex(index, storage);
    assert.deepEqual(await loadCadastralIndex("A564", new DiskCadastralStorage(directory)), index);
    await assert.rejects(storage.get("../secrets"));
    await assert.rejects(storage.put("A564", new Uint8Array(INDEX_MAX_BYTES + 1)));
    await utimes(join(directory, "A564.json"), 0, 0);
    assert.equal(await storage.get("A564"), undefined);
    assert.equal(await storage.get("D612"), undefined);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("Blob SDK uses private access, deterministic paths and bounded authenticated reads", async () => {
  let data: Uint8Array | undefined;
  let uploadedAt = new Date();
  const storage = new BlobCadastralStorage("fake-token", {
    get: async (path, options): Promise<GetBlobResult | null> => {
      assert.equal(path, "cadastral-index/v1/A564.json");
      assert.equal(options.access, "private");
      assert.equal(options.token, "fake-token");
      assert.equal(options.useCache, false);
      return data
        ? {
            statusCode: 200,
            stream: new ReadableStream({
              start(c) {
                c.enqueue(data!);
                c.close();
              },
            }),
            headers: new Headers(),
            blob: {
              url: "https://fake.private.blob.vercel-storage.com/index",
              downloadUrl: "https://fake.private.blob.vercel-storage.com/index",
              pathname: String(path),
              contentType: "application/json",
              contentDisposition: "inline",
              cacheControl: "max-age=60",
              uploadedAt,
              etag: "fake",
              size: data.length,
            },
          }
        : null;
    },
    put: async (path, body, options): Promise<PutBlobResult> => {
      assert.equal(options.access, "private");
      assert.equal(options.token, "fake-token");
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.allowOverwrite, true);
      data = new Uint8Array(body as Buffer);
      return {
        url: "https://fake.private.blob.vercel-storage.com/index",
        downloadUrl: "https://fake.private.blob.vercel-storage.com/index",
        pathname: String(path),
        contentType: "application/json",
        contentDisposition: "inline",
        etag: "fake",
      };
    },
  });
  assert.equal(await storage.get("A564"), undefined);
  await storeCadastralIndex(index, storage);
  assert.deepEqual(await loadCadastralIndex("A564", storage), index);
  data = new Uint8Array(INDEX_MAX_BYTES + 1);
  await assert.rejects(storage.get("A564"), /16 MiB/);
  uploadedAt = new Date(0);
  assert.equal(await storage.get("A564"), undefined);
});
test("prebuild validates all codes before starting, deduplicates and builds sequentially into fake storage", async () => {
  const storage = new FakeStorage();
  let active = 0,
    count = 0;
  const builder = async (code: string) => {
    assert.equal(++active, 1);
    count++;
    await Promise.resolve();
    active--;
    return { ...index, belfiore: code };
  };
  const result = await prebuildCadastre(["A564", "D612", "A564"], storage, builder);
  assert.equal(count, 2);
  assert.deepEqual(
    result.map((r) => r.belfiore),
    ["A564", "D612"],
  );
  assert.equal((await loadCadastralIndex("D612", storage))?.belfiore, "D612");
  await assert.rejects(prebuildCadastre(["D612", "../bad"], storage, builder));
  assert.equal(count, 2);
  assert.ok(DEFAULT_BELFIORE.includes("D612"));
});
