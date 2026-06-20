// Discover real Uzbek YouTube bloggers and insert them into Supabase.
// Standalone Node script (no edge-function deploy needed). Run from frontend/:
//
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   YOUTUBE_DATA_API_KEY=<youtube-data-api-v3-key> \
//   node scripts/discover-influencers.mjs
//
// Requires Node 18+ (global fetch). Uses the SERVICE ROLE key, which bypasses
// RLS — keep it local, never commit it. SUPABASE_URL falls back to VITE_SUPABASE_URL.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YT_KEY = process.env.YOUTUBE_DATA_API_KEY || process.env.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !YT_KEY) {
  console.error("Missing env. Need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUTUBE_DATA_API_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// CLI knobs: --max=80 --perQuery=25
const arg = (name, dflt) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? Number(m.split("=")[1]) : dflt;
};
const MAX_CHANNELS = Math.min(arg("max", 80), 300);
const MAX_PER_QUERY = Math.min(arg("perQuery", 25), 50);

// Region presets: YouTube regionCode + relevanceLanguage + localized queries.
// Choose with --regions=UZ,KZ,RU (default UZ). Add more by extending this map.
const REGION_DEFS = {
  UZ: {
    lang: "uz",
    queries: [
      "o'zbek bloger",
      "uzbek vlog",
      "Toshkent blog",
      "o'zbekcha",
      "uzbek tech",
      "uzbek beauty",
      "uzbek music",
      "uzbek comedy",
    ],
  },
  KZ: {
    lang: "kk",
    queries: [
      "qazaqsha blog",
      "kazakh vlog",
      "Almaty blogger",
      "qazaq tech",
      "kazakhstan beauty",
      "kazakh music",
    ],
  },
  RU: {
    lang: "ru",
    queries: ["русский блогер", "влог", "обзор техники", "бьюти блог", "трэвел влог"],
  },
  KG: { lang: "ky", queries: ["kyrgyz blog", "Bishkek vlog", "кыргыз блогер"] },
  TJ: { lang: "tg", queries: ["tajik blog", "Dushanbe vlog", "тоҷик блог"] },
};

const REGIONS = (() => {
  const m = process.argv.find((a) => a.startsWith("--regions="));
  const codes = (m ? m.split("=")[1] : "UZ")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  const valid = codes.filter((c) => REGION_DEFS[c]);
  return valid.length ? valid : ["UZ"];
})();
const ALLOWED = new Set(REGIONS);

const CATEGORY_KEYWORDS = {
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

function categorize(title, description) {
  const hay = `${title} ${description}`.toLowerCase();
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((w) => hay.includes(w))) return cat;
  }
  return "lifestyle";
}

async function searchChannelIds(query, max, region, lang) {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel` +
    `&regionCode=${region}&relevanceLanguage=${lang}&maxResults=${Math.min(max, 50)}` +
    `&q=${encodeURIComponent(query)}&key=${YT_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.error) throw new Error(`YouTube search: ${d.error.message}`);
  return (d.items ?? []).map((it) => it.id?.channelId).filter(Boolean);
}

async function getChannels(ids) {
  const out = [];
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
        avatar: c.snippet?.thumbnails?.high?.url ?? c.snippet?.thumbnails?.default?.url ?? null,
        country: c.snippet?.country ?? null,
        subscribers: Number(c.statistics?.subscriberCount ?? 0),
        views: Number(c.statistics?.viewCount ?? 0),
        videos: Number(c.statistics?.videoCount ?? 1),
      });
    }
  }
  return out;
}

function engagementRate(c) {
  if (!c.subscribers) return 0;
  const er = (c.views / Math.max(c.videos, 1) / c.subscribers) * 100;
  return Math.round(Math.min(100, er) * 100) / 100;
}

async function upsertChannel(c, result, regionFallback) {
  // If YouTube reports a country outside our target regions, skip; otherwise
  // tag with the reported country, falling back to the region we searched.
  if (c.country && !ALLOWED.has(c.country)) return result.skipped++;
  if (c.subscribers < 1000) return result.skipped++;
  const country = c.country ?? regionFallback;

  const channelUrl = `https://youtube.com/channel/${c.id}`;
  const er = engagementRate(c);
  const username = (c.handle ?? c.title).replace(/^@/, "");

  const { data: existing } = await supabase
    .from("social_platforms")
    .select("id, influencer_id")
    .eq("platform", "youtube")
    .eq("profile_url", channelUrl)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("social_platforms")
      .update({ followers_count: c.subscribers, engagement_rate: er })
      .eq("id", existing.id);
    await supabase
      .from("influencer_profiles")
      .update({ engagement_rate: er, avatar_url: c.avatar })
      .eq("id", existing.influencer_id);
    await supabase.from("influencer_analytics_history").insert({
      influencer_id: existing.influencer_id,
      platform: "youtube",
      followers_count: c.subscribers,
      engagement_rate: er,
    });
    return result.updated++;
  }

  const { data: prof, error: profErr } = await supabase
    .from("influencer_profiles")
    .insert({
      user_id: null,
      display_name: c.title,
      bio: c.description.slice(0, 280) || null,
      category: categorize(c.title, c.description),
      city: null,
      country,
      is_visible: true,
      avatar_url: c.avatar,
      onboarding_status: "completed",
      engagement_rate: er,
    })
    .select("id")
    .single();
  if (profErr || !prof) {
    console.warn("  insert failed:", c.title, profErr?.message);
    return result.skipped++;
  }

  await supabase.from("social_platforms").insert({
    influencer_id: prof.id,
    platform: "youtube",
    username,
    followers_count: c.subscribers,
    engagement_rate: er,
    profile_url: channelUrl,
    is_primary: true,
  });
  await supabase.from("influencer_analytics_history").insert({
    influencer_id: prof.id,
    platform: "youtube",
    followers_count: c.subscribers,
    engagement_rate: er,
  });
  console.log(`  + ${c.title} — ${c.subscribers.toLocaleString()} subs`);
  result.created++;
}

async function recomputeRanks() {
  const { data: profiles } = await supabase
    .from("influencer_profiles")
    .select("id")
    .eq("is_visible", true);
  if (!profiles?.length) return 0;
  const { data: socials } = await supabase
    .from("social_platforms")
    .select("influencer_id, followers_count");

  const totals = new Map(profiles.map((p) => [p.id, 0]));
  for (const s of socials ?? []) {
    if (totals.has(s.influencer_id)) {
      totals.set(s.influencer_id, totals.get(s.influencer_id) + Number(s.followers_count ?? 0));
    }
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  let rank = 1;
  for (const [id] of ranked) {
    await supabase.from("influencer_profiles").update({ league_rank: rank }).eq("id", id);
    rank++;
  }
  return ranked.length;
}

(async () => {
  console.log(`Discovering YouTube bloggers in [${REGIONS.join(", ")}] (max ${MAX_CHANNELS})…`);
  const idRegion = new Map(); // channelId -> region it was discovered in
  outer: for (const region of REGIONS) {
    const { lang, queries } = REGION_DEFS[region];
    for (const q of queries) {
      if (idRegion.size >= MAX_CHANNELS) break outer;
      try {
        for (const id of await searchChannelIds(q, MAX_PER_QUERY, region, lang)) {
          if (!idRegion.has(id)) idRegion.set(id, region);
          if (idRegion.size >= MAX_CHANNELS) break;
        }
        console.log(`  [${region}] "${q}" → ${idRegion.size} unique so far`);
      } catch (e) {
        console.warn(`  [${region}] "${q}" failed: ${e.message}`);
      }
    }
  }

  if (!idRegion.size) {
    console.log("No channels found.");
    return;
  }

  const channels = await getChannels([...idRegion.keys()]);
  const result = { created: 0, updated: 0, skipped: 0 };
  for (const c of channels) await upsertChannel(c, result, idRegion.get(c.id) ?? REGIONS[0]);

  const ranked = await recomputeRanks();
  console.log(
    `\nDone. discovered=${channels.length} created=${result.created} updated=${result.updated} skipped=${result.skipped} ranked=${ranked}`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
