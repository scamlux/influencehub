// process-scraping-queue
// Worker that drains pending rows in scraping_queue. For each item it calls
// fetch-social-stats, writes the fresh numbers to social_platforms, appends a
// row to influencer_analytics_history, and updates onboarding_status.
//
// Invoke on a cron (e.g. every minute) or manually from the admin queue page.
// Optional body: { limit?: number }  (default 10)

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function fetchStats(influencer_id: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/fetch-social-stats`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ influencer_id }),
  });
  return (await r.json()) as {
    stats?: { platform: string; followers_count: number; engagement_rate: number }[];
    error?: string;
  };
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { limit = 10 } = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const admin = adminClient();

    const { data: queue } = await admin
      .from("scraping_queue")
      .select("id, influencer_id")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (!queue?.length) return json({ processed: 0 });

    let processed = 0;
    for (const item of queue) {
      await admin.from("scraping_queue").update({ status: "processing" }).eq("id", item.id);

      try {
        const { stats, error } = await fetchStats(item.influencer_id);
        if (error || !stats) throw new Error(error ?? "no stats returned");

        let primaryEr = 0;
        for (const s of stats) {
          await admin
            .from("social_platforms")
            .update({
              followers_count: s.followers_count,
              engagement_rate: s.engagement_rate,
            })
            .eq("influencer_id", item.influencer_id)
            .eq("platform", s.platform);

          await admin.from("influencer_analytics_history").insert({
            influencer_id: item.influencer_id,
            platform: s.platform,
            followers_count: s.followers_count,
            engagement_rate: s.engagement_rate,
          });
          primaryEr = primaryEr || s.engagement_rate;
        }

        await admin
          .from("influencer_profiles")
          .update({ onboarding_status: "completed", engagement_rate: primaryEr, collection_error: null })
          .eq("id", item.influencer_id);

        await admin.from("scraping_queue").update({ status: "completed" }).eq("id", item.id);
        processed++;
      } catch (err) {
        const msg = String(err);
        await admin.from("scraping_queue").update({ status: "failed", error: msg }).eq("id", item.id);
        await admin
          .from("influencer_profiles")
          .update({ onboarding_status: "failed", collection_error: msg })
          .eq("id", item.influencer_id);
      }
    }

    return json({ processed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
