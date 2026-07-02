// Error monitoring (Sentry) — opt-in and dependency-light.
//
// Sentry only initialises when VITE_SENTRY_DSN is set AND the optional
// `@sentry/react` package is installed, so local/mock development pulls in nothing.
// To enable in production:
//   1. npm i @sentry/react            (in frontend/)
//   2. set VITE_SENTRY_DSN=<dsn>      (Vercel env)
//
// The import specifier is deliberately a widened `string` so tsc treats it as a
// dynamic import (returns any) instead of trying to resolve the module at build
// time — this keeps typecheck green before the package is installed. The
// /* @vite-ignore */ hint stops Vite from failing the bundle for the same reason.

let started = false;

export async function initMonitoring(): Promise<void> {
  if (started) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  started = true;

  const pkg: string = "@sentry/react";
  try {
    const Sentry = await import(/* @vite-ignore */ pkg);
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Conservative defaults; tune per traffic once real volume is known.
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  } catch {
    // @sentry/react not installed — monitoring stays a no-op.
  }
}

/** Report a handled error to Sentry when active; always safe to call. */
export async function captureError(error: unknown): Promise<void> {
  if (!started) return;
  try {
    const pkg: string = "@sentry/react";
    const Sentry = await import(/* @vite-ignore */ pkg);
    Sentry.captureException(error);
  } catch {
    // no-op
  }
}
