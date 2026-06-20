// claim-influencer
// Links an existing (admin-scraped, user_id = null) influencer profile to the
// authenticated user account so the creator can manage it.
//
// Body: { influencer_id: string }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient, getUser } from "../_shared/client.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { influencer_id } = await req.json();
    if (!influencer_id) return json({ error: "influencer_id is required" }, 400);

    const admin = adminClient();

    const { data: profile, error } = await admin
      .from("influencer_profiles")
      .select("id, user_id")
      .eq("id", influencer_id)
      .maybeSingle();

    if (error) return json({ error: error.message }, 500);
    if (!profile) return json({ error: "Influencer not found" }, 404);
    if (profile.user_id && profile.user_id !== user.id) {
      return json({ error: "This profile is already claimed" }, 409);
    }

    // Ensure the caller has the influencer role.
    await admin
      .from("user_roles")
      .upsert({ user_id: user.id, role: "influencer" }, { onConflict: "user_id" });

    const { error: linkErr } = await admin
      .from("influencer_profiles")
      .update({ user_id: user.id })
      .eq("id", influencer_id);
    if (linkErr) return json({ error: linkErr.message }, 500);

    await admin.from("admin_actions").insert({
      admin_id: user.id,
      action_type: "claim_influencer",
      target_table: "influencer_profiles",
      target_id: influencer_id,
      details: { claimed_by: user.id },
    });

    return json({ claimed: true, influencer_id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
