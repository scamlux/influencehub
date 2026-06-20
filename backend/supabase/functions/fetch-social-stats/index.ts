// fetch-social-stats
// Fetches follower counts + engagement rate for an influencer's connected
// platforms (YouTube / Instagram / TikTok / Telegram).
//
// Real providers (used when the matching secret is set):
//   YOUTUBE_API_KEY      — YouTube Data API v3 (channels.statistics)
//   ENSEMBLEDATA_TOKEN   — EnsembleData (Instagram + TikTok user info)
//   APIFY_API_KEY        — optional Apify fallback for Instagram/TikTok
//
// When a provider key is missing OR a lookup fails, the platform's CURRENT
// stored follower count is kept unchanged — we never overwrite real numbers
// (e.g. the seeded CIS blogger base) with placeholder data.
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

const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? Deno.env.get("YOUTUBE_DATA_API_KEY") ?? "";
const ED_TOKEN = Deno.env.get("ENSEMBLEDATA_TOKEN") ?? "";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── YouTube Data API v3 ───────────────────────────────────────────────────────
async function fetchYouTube(username: string): Promise<Partial<Stat> | null> {
  if (!YT_KEY) return null;
  const handle = username.replace(/^@/, "");
  const url =
    `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${handle}&key=${YT_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  const s = d.items?.[0]?.statistics;
  if (!s) return null;
  const followers = Number(s.subscriberCount ?? 0);
  const views = Number(s.viewCount ?? 0);
  const videos = Number(s.videoCount ?? 1);
  const er = followers ? Math.min(100, (views / videos / followers) * 100) : 0;
  return { followers_count: followers, engagement_rate: round2(er) };
}

// ── EnsembleData: Instagram ───────────────────────────────────────────────────
async function fetchInstagram(username: string): Promise<Partial<Stat> | null> {
  if (!ED_TOKEN) return null;
  const u = username.replace(/^@/, "");
  const url =
    `https://ensembledata.com/apis/instagram/user/info?username=${encodeURIComponent(u)}&token=${ED_TOKEN}`;
  const r = await fetch(url);
  const d = await r.json();
  const data = d?.data ?? d;
  const followers = Number(
    data?.follower_count ?? data?.edge_followed_by?.count ?? data?.followers ?? 0,
  );
  if (!followers) return null;
  // EnsembleData may include recent media engagement; approximate ER if present.
  const likes = Number(data?.avg_likes ?? data?.average_likes ?? 0);
  const comments = Number(data?.avg_comments ?? data?.average_comments ?? 0);
  const er = followers && (likes || comments) ? ((likes + comments) / followers) * 100 : 0;
  return { followers_count: followers, engagement_rate: er ? round2(Math.min(100, er)) : 0 };
}

// ── EnsembleData: TikTok ──────────────────────────────────────────────────────
async function fetchTikTok(username: string): Promise<Partial<Stat> | null> {
  if (!ED_TOKEN) return null;
  const u = username.replace(/^@/, "");
  const url =
    `https://ensembledata.com/apis/tt/user/info-from-username?username=${encodeURIComponent(u)}&token=${ED_TOKEN}`;
  const r = await fetch(url);
  const d = await r.json();
  const data = d?.data ?? d;
  const stats = data?.stats ?? data?.user?.stats ?? data;
  const followers = Number(stats?.followerCount ?? stats?.follower_count ?? 0);
  if (!followers) return null;
  const hearts = Number(stats?.heartCount ?? stats?.heart ?? 0);
  const videos = Number(stats?.videoCount ?? 1);
  const er = followers && hearts ? Math.min(100, (hearts / Math.max(videos, 1) / followers) * 100) : 0;
  return { followers_count: followers, engagement_rate: round2(er) };
}

async function fetchPlatform(platform: string, username: string): Promise<Partial<Stat> | null> {
  try {
    if (platform === "youtube") return await fetchYouTube(username);
    if (platform === "instagram") return await fetchInstagram(username);
    if (platform === "tiktok") return await fetchTikTok(username);
    return null; // telegram + anything else: no provider wired
  } catch (e) {
    console.error(`fetch ${platform}/${username}: ${e}`);
    return null;
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
      .select("id, platform, username, followers_count, engagement_rate")
      .eq("influencer_id", influencer_id);

    if (error) return json({ error: error.message }, 500);
    if (!socials?.length) return json({ influencer_id, stats: [] });

    const stats: Stat[] = [];
    for (const s of socials) {
      const fresh = s.username ? await fetchPlatform(s.platform, s.username) : null;
      // Keep the existing values when the provider returns nothing — never
      // clobber real numbers with placeholders.
      stats.push({
        platform: s.platform,
        username: s.username ?? "",
        followers_count: fresh?.followers_count ?? Number(s.followers_count ?? 0),
        engagement_rate: fresh?.engagement_rate ?? Number(s.engagement_rate ?? 0),
      });
    }

    return json({ influencer_id, stats });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
