import { NextResponse, type NextRequest } from "next/server";
import { configuredCounterStore, enforceApiLimit } from "#server/http/rate-limit.ts";
import { errorResponse } from "#server/http/responses.ts";
import { logEvent, routeName } from "#server/core/observability.ts";

const counters = configuredCounterStore();
export async function proxy(request: NextRequest) {
  const started = performance.now();
  try {
    await enforceApiLimit(request, counters);
    return NextResponse.next();
  } catch (error) {
    const response = errorResponse(error);
    logEvent({
      event: "request",
      route: routeName(request.nextUrl.pathname),
      source: null,
      host: null,
      durationMs: Math.round(performance.now() - started),
      outcome: "error",
      status: response.status,
      cache: "none",
    });
    response.headers.set("Server-Timing", `proxy;dur=${(performance.now() - started).toFixed(1)}`);
    return response;
  }
}
export const config = { matcher: "/api/v1/:path*" };
