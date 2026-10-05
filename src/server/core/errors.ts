import { ZodError } from "zod";
import type { ApiError } from "#contracts";

export class BackendError extends Error {
  readonly code: ApiError["error"]["code"];

  readonly status: number;

  constructor(code: ApiError["error"]["code"], message: string, status: number) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class UpstreamError extends BackendError {
  constructor(message = "La fonte non è disponibile.") {
    super("upstream_unavailable", message, 502);
  }
}

export class NotFound extends BackendError {
  constructor(message = "Nessun risultato trovato.") {
    super("not_found", message, 404);
  }
}

export class OutsideCoverage extends NotFound {
  constructor(message = "Il punto è fuori dalla copertura della fonte.") {
    super(message);
  }
}

export class BadRequest extends BackendError {
  constructor(message = "Parametri non validi.") {
    super("bad_request", message, 400);
  }
}

export class NotConfigured extends BackendError {
  constructor(message = "Servizio non configurato.") {
    super("not_configured", message, 503);
  }
}

export class RateLimited extends BackendError {
  readonly retryAfterSeconds: number;

  constructor(message = "Limite temporaneo di richieste raggiunto.", retryAfterSeconds = 30) {
    super("rate_limited", message, 429);
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export function apiError(error: unknown): { body: ApiError; status: number } {
  if (error instanceof BackendError)
    return { body: { error: { code: error.code, message: error.message } }, status: error.status };
  if (error instanceof ZodError)
    return { body: { error: { code: "bad_request", message: "Parametri non validi." } }, status: 400 };
  return { body: { error: { code: "internal", message: "Errore interno." } }, status: 500 };
}
