import { createHash, timingSafeEqual } from "node:crypto";

/** Trust only platform headers: x-real-ip, otherwise the hop appended by the nearest proxy. */
export function clientAddress(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .at(-1) ?? "local"
  );
}

export const keyDigest = (value: string) => createHash("sha256").update(value).digest("hex");

export function bearerDigest(request: Request): string | undefined {
  const header = request.headers.get("authorization");
  if (!header || header.length > 4096) return undefined;
  const match = header.match(/^Bearer ([^\s]+)$/i);
  return match ? keyDigest(match[1]) : undefined;
}

/** Environment contains SHA-256 hashes only; never store, return or log the raw keys. */
export function matchesKey(digest: string | undefined, hashes: string | undefined): boolean {
  if (!hashes?.trim()) return false;
  const entries = hashes.split(",").map((s) => s.trim());
  if (entries.some((s) => !/^[a-f0-9]{64}$/i.test(s)))
    throw new Error("API key configuration must contain SHA-256 hashes");
  return !!digest && entries.some((s) => timingSafeEqual(Buffer.from(s, "hex"), Buffer.from(digest, "hex")));
}
