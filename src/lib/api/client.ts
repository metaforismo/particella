import { z } from "zod";
import { ApiError, LayerCatalogEntry, LayerResult, Plot, type LayerId } from "@/lib/contracts";

/** Error thrown by the client; `code` mirrors the API envelope so the UI can phrase it. */
export class ApiRequestError extends Error {
  constructor(
    readonly code: ApiError["error"]["code"] | "network",
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { signal, headers: { accept: "application/json" } });
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
    throw new ApiRequestError("network", "Connessione assente o instabile.", 0);
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiError.safeParse(body);
    throw parsed.success
      ? new ApiRequestError(parsed.data.error.code, parsed.data.error.message, res.status)
      : new ApiRequestError("internal", `Risposta inattesa (${res.status}).`, res.status);
  }
  return schema.parse(body);
}

export const api = {
  plotAt: (lat: number, lon: number, signal?: AbortSignal) =>
    getJson(`/api/v1/plots/at?lat=${lat}&lon=${lon}`, Plot, signal),

  plot: (id: string, signal?: AbortSignal) =>
    getJson(`/api/v1/plots/${encodeURIComponent(id)}`, Plot, signal),

  layer: (plotId: string, layer: LayerId, signal?: AbortSignal) =>
    getJson(`/api/v1/plots/${encodeURIComponent(plotId)}/layers/${layer}`, LayerResult, signal),

  layerCatalog: (signal?: AbortSignal) =>
    getJson("/api/v1/catalog/layers", z.array(LayerCatalogEntry), signal),
};
