// discover-influencers
// Populates the league with REAL Uzbek bloggers by discovering channels via the
// YouTube Data API (regionCode=UZ) and creating unclaimed influencer profiles
// for them. Optionally enriches with Apify / EnsembleData (Instagram, TikTok).
//
// All API keys come from edge-function secrets — never hard-code them:
//   YOUTUBE_DATA_API_KEY (or YOUTUBE_API_KEY)
//   APIFY_API_KEY            (optional)
//   ENSEMBLEDATA_TOKEN       (optional)
//   SOCIALKIT_API_KEY        (optional)
//
// Protect this endpoint: it is registered with verify_jwt = false and must be
// invoked with the service-role key in the Authorization header (like the other
// worker functions). Optionally set DISCOVER_SECRET and pass it as x-admin-secret.
//
// Body (all optional):
//   { queries?: string[], maxPerQuery?: number, maxChannels?: number }
// Returns: { discovered, created, updated, skipped, ranked }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";

const YT_KEY =
  Deno.env.get("YOUTUBE_DATA_API_KEY") ?? Deno.env.get("YOUTUBE_API_KEY") ?? "";

// Search terms biased toward Uzbek creators. Each YouTube search costs ~100
// quota units, so keep this list modest (default daily quota is 10k units).
const DEFAULT_QUERIES = [
  "o'zbek bloger",
  "uzbek vlog",
  "Toshkent blog",
  "o'zbekcha",
  "uzbek tech",
  "uzbek beauty",
  "uzbek music",
  "uzbek comedy",
];

// Map free-text channel signals to the DB's fixed category enum.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  food: ["food", "oshxona", "retsept", "cook", "kitchen", "ovqat"],
  tech: ["tech", "gadget", "telefon", "smartphone", "review", "obzor"],
  fashion: ["fashion", "moda", "style", "kiyim"],
  beauty: ["beauty", "makeup", "go'zallik", "kosmetika", "skincare"],
  travel: ["travel", "sayohat", "vlog", "trip"],
  education: ["education", "ta'lim", "lesson", "dars", "english", "ingliz"],
  sports: ["sport", "fitness", "futbol", "gym", "workout"],
  entertainment: ["comedy", "prikol", "show", "music", "qo'shiq", "klip", "tv"],
  business: ["business", "biznes", "marketing", "pul"],
  auto: ["auto", "car", "avto", "mashina"],
};

function categorize(title: string, description: string): string {
  const hay = `${title} ${description}`.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) return cat;
  }
  return "lifestyle"; // safe default that satisfies the CHECK constraint
}

type YtChannel = {
  id: string;
  title: string;
  description: string;
  handle: string | null;
  avatar: string | null;
  country: string | null;
  subscribers: number;
  views: number;
  videos: number;
};

// ── YouTube Data API ──────────────────────────────────────────────────────────
async function searchChannelIds(query: string, max: number): Promise<string[]> {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel` +
    `&regionCode=UZ&relevanceLanguage=uz&maxResults=${Math.min(max, 50)}` +
    `&q=${encodeURIComponent(query)}&key=${YT_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.error) throw new Error(`YouTube search: ${d.error.message}`);
  return (d.items ?? [])
    .map((it: any) => it.id?.channelId)
    .filter((x: unknown): x is string => typeof x === "string");
}

async function getChannels(ids: string[]): Promise<YtChannel[]> {
  const out: YtChannel[] = [];
  // channels.list accepts up to 50 ids per call.
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics` +
      `&id=${batch.join(",")}&key=${YT_KEY}`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) throw new Error(`YouTube channels: ${d.error.message}`);
    for (const c of d.items ?? []) {
      out.push({
        id: c.id,
        title: c.snippet?.title ?? "Unknown",
        description: c.snippet?.description ?? "",
        handle: c.snippet?.customUrl ?? null,
        avatar:
          c.snippet?.thumbnails?.high?.url ??
          c.snippet?.thumbnails?.default?.url ??
          null,
        country: c.snippet?.country ?? null,
        subscribers: Number(c.statistics?.subscriberCount ?? 0),
        views: Number(c.statistics?.viewCount ?? 0),
        videos: Number(c.statistics?.videoCount ?? 1),
      });
    }
  }
  return out;
}

function engagementRate(c: YtChannel): number {
  if (!c.subscribers) return 0;
  const er = (c.views / Math.max(c.videos, 1) / c.subscribers) * 100;
  return Math.round(Math.min(100, er) * 100) / 100;
}

// ── Persistence ───────────────────────────────────────────────────────────────
type Result = { created: number; updated: number; skipped: number };

async function upsertChannel(
  admin: ReturnType<typeof adminClient>,
  c: YtChannel,
  result: Result,
) {
  // Filter out channels that explicitly belong to another country.
  if (c.country && c.country !== "UZ") {
    result.skipped++;
    return;
  }
  if (c.subscribers < 1000) {
    result.skipped++;
    return;
  }

  const channelUrl = `https://youtube.com/channel/${c.id}`;
  const er = engagementRate(c);
  const username = (c.handle ?? c.title).replace(/^@/, "");

  // Dedupe by the canonical channel URL stored on the social_platforms row.
  const { data: existing } = await admin
    .from("social_platforms")
    .select("id, influencer_id")
    .eq("platform", "youtube")
    .eq("profile_url", channelUrl)
    .maybeSingle();

  if (existing) {
    await admin
      .from("social_platforms")
      .update({ followers_count: c.subscribers, engagement_rate: er })
      .eq("id", existing.id);
    await admin
      .from("influencer_profiles")
      .update({ engagement_rate: er, avatar_url: c.avatar })
      .eq("id", existing.influencer_id);
    await admin.from("influencer_analytics_history").insert({
      influencer_id: existing.influencer_id,
      platform: "youtube",
      followers_count: c.subscribers,
      engagement_rate: er,
    });
    result.updated++;
    return;
  }

  // Create a new unclaimed influencer profile (user_id stays NULL until a real
  // creator claims it via the claim-influencer function).
  const { data: prof, error: profErr } = await admin
    .from("influencer_profiles")
    .insert({
      user_id: null,
      display_name: c.title,
      bio: c.description.slice(0, 280) || null,
      category: categorize(c.title, c.description),
      city: null,
      is_visible: true,
      avatar_url: c.avatar,
      onboarding_status: "completed",
      engagement_rate: er,
    })
    .select("id")
    .single();
  if (profErr || !prof) {
    result.skipped++;
    return;
  }

  await admin.from("social_platforms").insert({
    influencer_id: prof.id,
    platform: "youtube",
    username,
    followers_count: c.subscribers,
    engagement_rate: er,
    profile_url: channelUrl,
    is_primary: true,
  });

  await admin.from("influencer_analytics_history").insert({
    influencer_id: prof.id,
    platform: "youtube",
    followers_count: c.subscribers,
    engagement_rate: er,
  });

  result.created++;
}

// Recompute league_rank for every visible influencer by total followers.
async function recomputeRanks(admin: ReturnType<typeof adminClient>): Promise<number> {
  const { data: profiles } = await admin
    .from("influencer_profiles")
    .select("id")
    .eq("is_visible", true);
  if (!profiles?.length) return 0;

  const { data: socials } = await admin
    .from("social_platforms")
    .select("influencer_id, followers_count");

  const totals = new Map<string, number>();
  for (const p of profiles) totals.set(p.id, 0);
  for (const s of socials ?? []) {
    if (totals.has(s.influencer_id)) {
      totals.set(s.influencer_id, (totals.get(s.influencer_id) ?? 0) + Number(s.followers_count ?? 0));
    }
  }

  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  let rank = 1;
  for (const [id] of ranked) {
    await admin.from("influencer_profiles").update({ league_rank: rank }).eq("id", id);
    rank++;
  }
  return ranked.length;
}

// ── Optional enrichment (Instagram / TikTok) ──────────────────────────────────
// To add Apify or EnsembleData enrichment, create a sibling helper that reads its
// key from env and returns { platform, username, followers_count, engagement_rate }
// rows, then insert them into social_platforms for the matching influencer. Wrap
// every provider call in try/catch so a shape mismatch never aborts the YouTube
// ingestion above. Example Apify pattern (confirm actor id + input first):
//   POST https://api.apify.com/v2/acts/<actor>/run-sync-get-dataset-items?token=$APIFY_API_KEY
// Example EnsembleData pattern:
//   GET  https://ensembledata.com/apis/<endpoint>?token=$ENSEMBLEDATA_TOKEN&...

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  // Optional shared-secret guard.
  const guard = Deno.env.get("DISCOVER_SECRET");
  if (guard && req.headers.get("x-admin-secret") !== guard) {
    return json({ error: "Forbidden" }, 403);
  }

  if (!YT_KEY) {
    return json({ error: "YOUTUBE_DATA_API_KEY (or YOUTUBE_API_KEY) is not set" }, 500);
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const queries: string[] = Array.isArray(body.queries) && body.queries.length
      ? body.queries
      : DEFAULT_QUERIES;
    const maxPerQuery: number = Math.min(Number(body.maxPerQuery ?? 25), 50);
    const maxChannels: number = Math.min(Number(body.maxChannels ?? 100), 300);

    const admin = adminClient();

    // 1) Discover unique channel ids across all queries.
    const ids = new Set<string>();
    for (const q of queries) {
      if (ids.size >= maxChannels) break;
      try {
        for (const id of await searchChannelIds(q, maxPerQuery)) {
          ids.add(id);
          if (ids.size >= maxChannels) break;
        }
      } catch (e) {
        // One bad query (e.g. quota) shouldn't abort the whole run.
        console.error(String(e));
      }
    }

    if (!ids.size) return json({ discovered: 0, created: 0, updated: 0, skipped: 0, ranked: 0 });

    // 2) Fetch channel details and upsert each.
    const channels = await getChannels([...ids]);
    const result: Result = { created: 0, updated: 0, skipped: 0 };
    for (const c of channels) {
      await upsertChannel(admin, c, result);
    }

    // 3) Re-rank the league by total followers.
    const ranked = await recomputeRanks(admin);

    return json({ discovered: channels.length, ...result, ranked });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
