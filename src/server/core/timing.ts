/** Per-request clock: never shared between reports or included in the public data contract. */
export class ServerTiming {
  private entries: { name: string; durationMs: number }[] = [];

  async measure<T>(name: string, action: () => Promise<T>): Promise<T> {
    const started = performance.now();
    try {
      return await action();
    } finally {
      this.entries.push({ name, durationMs: performance.now() - started });
    }
  }

  header(): string {
    return this.entries
      .map(({ name, durationMs }) => `${name.replace(/[^a-zA-Z0-9_-]/g, "_")};dur=${durationMs.toFixed(1)}`)
      .join(", ");
  }
}
