// send-magic-link
// Sends a passwordless (magic link) sign-in email via Supabase Auth admin API.
//
// Body: { email: string, redirect_to?: string }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { email, redirect_to } = await req.json();
    if (!isEmail(email)) return json({ error: "A valid email is required" }, 400);

    const admin = adminClient();

    // Generate a magic-link token. With SMTP configured, Supabase emails it.
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: redirect_to ?? "https://influencehub.app/auth/callback",
      },
    });

    if (error) return json({ error: error.message }, 500);

    // Never return the raw action link to the client in production.
    return json({ sent: true, email: data.user?.email ?? email });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
