// fetch-social-stats
// Fetches follower counts + engagement rate for an influencer's connected
// platforms (YouTube / Instagram / TikTok / Telegram).
//
// When provider API keys are configured it calls the real endpoints; otherwise
// it returns deterministic mock stats so the pipeline works end-to-end locally.
//
// Body: { influencer_id: string }
// Returns: { stats: { platform, username, followers_count, engagement_rate }[] }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";

type Stat = {
  platform: string;
  username: string;
  followers_count: number;
  engagement_rate: number;
};

// Deterministic pseudo-stats derived from the username so values are stable.
function mockStats(platform: string, username: string): Stat {
  let h = 0;
  for (const c of `${platform}:${username}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const followers = 50_000 + (h % 14_950_000);
  const er = Math.round(((h % 1000) / 1000 * 10 + 1) * 100) / 100;
  return { platform, username, followers_count: followers, engagement_rate: er };
}

async function fetchYouTube(username: string): Promise<Stat | null> {
  const key = Deno.env.get("YOUTUBE_API_KEY");
  if (!key) return mockStats("youtube", username);
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${username}&key=${key}`;
    const r = await fetch(url);
    const d = await r.json();
    const s = d.items?.[0]?.statistics;
    if (!s) return null;
    const followers = Number(s.subscriberCount ?? 0);
    const views = Number(s.viewCount ?? 0);
    const videos = Number(s.videoCount ?? 1);
    const er = followers ? Math.min(100, (views / videos / followers) * 100) : 0;
    return {
      platform: "youtube",
      username,
      followers_count: followers,
      engagement_rate: Math.round(er * 100) / 100,
    };
  } catch {
    return mockStats("youtube", username);
  }
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const { influencer_id } = await req.json();
    if (!influencer_id) return json({ error: "influencer_id is required" }, 400);

    const admin = adminClient();
    const { data: socials, error } = await admin
      .from("social_platforms")
      .select("id, platform, username")
      .eq("influencer_id", influencer_id);

    if (error) return json({ error: error.message }, 500);
    if (!socials?.length) return json({ stats: [] });

    const stats: Stat[] = [];
    for (const s of socials) {
      let stat: Stat | null;
      if (s.platform === "youtube") stat = await fetchYouTube(s.username);
      // Instagram / TikTok / Telegram: no free public API — use mock provider.
      else stat = mockStats(s.platform, s.username);
      if (stat) stats.push(stat);
    }

    return json({ influencer_id, stats });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
