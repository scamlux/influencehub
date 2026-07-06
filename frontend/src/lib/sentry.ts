import * as Sentry from "@sentry/react";

// Error reporting is opt-in: without a DSN the app runs exactly as before
// (mock mode, local dev, CI) and nothing is sent anywhere.
const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export const SENTRY_ENABLED = Boolean(dsn);

export function initSentry() {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  });
}

/** Report a caught error (no-op when Sentry is not configured). */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!SENTRY_ENABLED) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
