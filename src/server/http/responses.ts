import { z } from "zod";
import { ApiError } from "../../lib/contracts/index.ts";
import { apiError, BackendError, BadRequest } from "../core/errors.ts";

export function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  try {
    if (process.env.NODE_ENV !== "production") return schema.parse(value);
    const result = schema.safeParse(value);
    if (result.success) return result.data;
  } catch {
    /* Report shape failures below, without logging query/payload or secrets. */
  }
  console.error("Particella: response_schema_invalid");
  throw new BackendError("internal", "Errore interno nella risposta.", 500);
}
export function jsonResponse<T>(schema: z.ZodType<T>, value: unknown, maxAge = 0): Response {
  return Response.json(validated(schema, value), {
    headers: {
      "Cache-Control": maxAge ? `public, max-age=${maxAge}, s-maxage=${maxAge}` : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export function errorResponse(error: unknown): Response {
  const { body, status } = apiError(error);
  if (status === 500) console.error("Particella: internal_error");
  return Response.json(validated(ApiError, body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...(status === 429 ? { "Retry-After": "30" } : {}),
    },
  });
}
export async function route(action: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await action();
  } catch (error) {
    return errorResponse(error);
  }
}
export function query<T>(request: Request, schema: z.ZodType<T>): T {
  const params = new URL(request.url).searchParams;
  for (const key of params.keys())
    if (params.getAll(key).length !== 1) throw new BadRequest("Parametri duplicati non ammessi.");
  return schema.parse(Object.fromEntries(params));
}
export function coordinateQuery() {
  const number = z
    .string()
    .min(1)
    .regex(/^-?(?:\d+(?:\.\d*)?|\.\d+)$/)
    .transform(Number)
    .pipe(z.number().finite());
  return z
    .object({
      lat: number.pipe(z.number().min(-90).max(90)),
      lon: number.pipe(z.number().min(-180).max(180)),
      country: z.literal("it").default("it"),
    })
    .strict();
}
