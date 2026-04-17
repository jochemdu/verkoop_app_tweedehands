// Next.js instrumentation hook — draait bij server-start.
// Initialiseert Sentry alleen als DSN env var gezet is (dev zonder Sentry = geen problem).

export async function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? "local",
      release: process.env.VERCEL_GIT_COMMIT_SHA,
    });
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    const Sentry = await import("@sentry/nextjs");
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      environment: process.env.VERCEL_ENV ?? "local",
    });
  }
}

export async function onRequestError(err: unknown, request: unknown, context: unknown) {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(err, request as Parameters<typeof Sentry.captureRequestError>[1], context as Parameters<typeof Sentry.captureRequestError>[2]);
}
