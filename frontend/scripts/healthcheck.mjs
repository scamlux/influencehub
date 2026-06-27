// Record the outcome of a discovery refresh so we know the cron stays alive,
// and ping Slack when something fails.
//
// run-all.sh calls this at the end with the per-job results, e.g.:
//   node healthcheck.mjs \
//     --started=2026-06-27T03:00:00Z \
//     --job=youtube:ok --job=telegram:failed --job=instagram:skipped
//
// Writes one row to public.discovery_runs (service-role key, bypasses RLS) and,
// if SLACK_WEBHOOK_URL is set, posts a message on any failure.
//
// Node 18+ (global fetch). Never throws — a broken healthcheck must not mask the
// refresh result, so all errors are logged and we exit 0.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const argVal = (name) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.slice(name.length + 3) : undefined;
};

// Collect every --job=<name>:<status> into { name: status }.
const jobs = {};
const failures = [];
for (const a of process.argv) {
  if (!a.startsWith("--job=")) continue;
  const [name, status] = a.slice("--job=".length).split(":");
  if (!name) continue;
  jobs[name] = status || "unknown";
  if (status === "failed") failures.push(name);
}

const startedAt = argVal("started") || null;
const finishedAt = new Date().toISOString();
const durationMs =
  startedAt && !Number.isNaN(Date.parse(startedAt))
    ? Date.parse(finishedAt) - Date.parse(startedAt)
    : null;

const ran = Object.values(jobs).filter((s) => s !== "skipped").length;
const status = failures.length === 0 ? "ok" : ran > failures.length ? "partial" : "failed";

async function recordRun() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error("[healthcheck] missing SUPABASE_URL / SERVICE_ROLE_KEY — skipping DB write");
    return;
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await supabase.from("discovery_runs").insert({
    status,
    jobs,
    failures,
    duration_ms: durationMs,
    started_at: startedAt,
    finished_at: finishedAt,
  });
  if (error) console.error("[healthcheck] DB write failed:", error.message);
  else console.error(`[healthcheck] recorded run: ${status} (${JSON.stringify(jobs)})`);
}

async function alertSlack() {
  if (failures.length === 0) return;
  if (!SLACK_WEBHOOK_URL) {
    console.error("[healthcheck] failures detected but SLACK_WEBHOOK_URL unset — no alert sent");
    return;
  }
  const lines = Object.entries(jobs).map(([n, s]) => {
    const icon = s === "ok" ? "✅" : s === "skipped" ? "⏭️" : "❌";
    return `${icon} ${n}: ${s}`;
  });
  const text = [
    `:rotating_light: *Discovery refresh ${status}* — ${failures.length} job(s) failed`,
    "```",
    ...lines,
    "```",
    `finished ${finishedAt}`,
  ].join("\n");
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error(`[healthcheck] Slack POST failed: ${res.status}`);
    else console.error("[healthcheck] Slack alert sent");
  } catch (e) {
    console.error("[healthcheck] Slack POST error:", e.message);
  }
}

await recordRun();
await alertSlack();
// Exit non-zero only so the cron log reflects a failed refresh; never block.
process.exit(0);
