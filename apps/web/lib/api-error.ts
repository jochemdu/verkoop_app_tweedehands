import { NextResponse } from "next/server";

// Unified error response shape. Elke API route gebruikt deze helpers zodat
// de client altijd {error, code, correlation_id, issues?} kan verwachten.

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL"
  | "DEPENDENCY_ERROR";

type ErrorBody = {
  error: string;
  code: ApiErrorCode;
  correlation_id?: string;
  issues?: unknown;
};

export function apiError(
  message: string,
  code: ApiErrorCode,
  status: number,
  extras?: { issues?: unknown; correlationId?: string },
) {
  const body: ErrorBody = {
    error: message,
    code,
    correlation_id: extras?.correlationId,
  };
  if (extras?.issues) body.issues = extras.issues;
  return NextResponse.json(body, { status });
}

export const apiErrors = {
  unauthorized: (correlationId?: string) =>
    apiError("Niet ingelogd", "UNAUTHORIZED", 401, { correlationId }),
  forbidden: (correlationId?: string) =>
    apiError("Geen toegang", "FORBIDDEN", 403, { correlationId }),
  notFound: (resource: string, correlationId?: string) =>
    apiError(`${resource} niet gevonden`, "NOT_FOUND", 404, { correlationId }),
  validation: (message: string, issues: unknown, correlationId?: string) =>
    apiError(message, "VALIDATION", 400, { issues, correlationId }),
  conflict: (message: string, correlationId?: string) =>
    apiError(message, "CONFLICT", 409, { correlationId }),
  rateLimited: (correlationId?: string) =>
    apiError("Te veel requests, probeer later opnieuw", "RATE_LIMITED", 429, {
      correlationId,
    }),
  internal: (correlationId?: string) =>
    apiError("Interne serverfout", "INTERNAL", 500, { correlationId }),
  dependency: (name: string, correlationId?: string) =>
    apiError(`External dependency ${name} niet bereikbaar`, "DEPENDENCY_ERROR", 502, {
      correlationId,
    }),
};

export function getCorrelationId(req: Request): string {
  return (
    req.headers.get("x-correlation-id") ??
    req.headers.get("x-request-id") ??
    crypto.randomUUID()
  );
}
