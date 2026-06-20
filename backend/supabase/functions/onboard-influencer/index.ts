// onboard-influencer
// Accepts the influencer's social usernames, upserts social_platforms rows,
// queues a stat-scraping job, and flips onboarding_status -> "processing".
//
// Body: { platforms: { platform: "youtube"|"instagram"|"tiktok"|"telegram",
//                        username: string }[] }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient, getUser } from "../_shared/client.ts";

const VALID = new Set(["youtube", "instagram", "tiktok", "telegram"]);

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { platforms } = await req.json();
    if (!Array.isArray(platforms) || platforms.length === 0) {
      return json({ error: "At least one platform is required" }, 400);
    }

    const admin = adminClient();

    // Resolve (or create) the caller's influencer profile.
    let { data: profile } = await admin
      .from("influencer_profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile) {
      const { data: created, error: createErr } = await admin
        .from("influencer_profiles")
        .insert({
          user_id: user.id,
          display_name: user.user_metadata?.full_name ?? "New Creator",
          onboarding_status: "processing",
        })
        .select("id")
        .single();
      if (createErr) return json({ error: createErr.message }, 500);
      profile = created;
    }

    const influencer_id = profile!.id;

    // Upsert each provided platform username.
    for (const p of platforms) {
      if (!VALID.has(p.platform) || !p.username) continue;
      const { data: existing } = await admin
        .from("social_platforms")
        .select("id")
        .eq("influencer_id", influencer_id)
        .eq("platform", p.platform)
        .maybeSingle();

      if (existing) {
        await admin
          .from("social_platforms")
          .update({ username: p.username })
          .eq("id", existing.id);
      } else {
        await admin.from("social_platforms").insert({
          influencer_id,
          platform: p.platform,
          username: p.username,
          profile_url: `https://${p.platform}.com/${p.username}`,
          is_primary: platforms.indexOf(p) === 0,
        });
      }
    }

    // Mark processing + clear prior errors, then enqueue scraping.
    await admin
      .from("influencer_profiles")
      .update({ onboarding_status: "processing", collection_error: null })
      .eq("id", influencer_id);

    await admin
      .from("scraping_queue")
      .insert({ influencer_id, status: "pending" });

    return json({ status: "processing", influencer_id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
