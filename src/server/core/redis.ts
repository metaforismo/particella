/** Small Redis REST command client shared by cache, atomic counters and observations. */
export class RedisRestClient {
  private readonly endpoint: string;
  private readonly token: string;
  private readonly fetcher: typeof fetch;
  constructor(endpoint: string, token: string, fetcher: typeof fetch = (...args) => fetch(...args)) {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !token)
      throw new Error("Invalid shared cache configuration");
    this.endpoint = url.toString();
    this.token = token;
    this.fetcher = fetcher;
  }
  async command(command: (string | number)[]): Promise<unknown> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(500),
      redirect: "error",
      cache: "no-store",
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Shared cache unavailable");
    }
    const text = await response.text();
    if (text.length > 24_000_000) throw new Error("Shared cache value exceeds limit");
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || !("result" in data) || "error" in data)
      throw new Error("Invalid shared cache response");
    return data.result;
  }
}

export function configuredRedis(): RedisRestClient | undefined {
  const endpoint = process.env.PARTICELLA_CACHE_REDIS_REST_URL;
  const token = process.env.PARTICELLA_CACHE_REDIS_REST_TOKEN;
  if (!endpoint && !token) return undefined;
  if (!endpoint || !token) throw new Error("Both Redis REST variables are required");
  return new RedisRestClient(endpoint, token);
}
