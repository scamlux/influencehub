// Pull REAL Telegram channel stats (free) by scraping the public web preview
// at https://t.me/s/<channel>, and upsert them as influencers in Supabase.
// Telegram has no public search API, so you supply the channel usernames.
//
// Run from frontend/:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   node scripts/discover-telegram.mjs --channels=kunuz,gazetauz,daryo_uz [--country=UZ]
//   node scripts/discover-telegram.mjs --file=channels.txt   # one username per line
//
// Node 18+ (global fetch). Service-role key bypasses RLS — local use only.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { UZ_TELEGRAM } from "./uz-starter.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const argVal = (name) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split("=")[1] : undefined;
};

const COUNTRY = (argVal("country") || "UZ").toUpperCase();

function loadChannels() {
  const out = [];
  const csv = argVal("channels");
  if (csv) out.push(...csv.split(","));
  const file = argVal("file");
  if (file) out.push(...readFileSync(file, "utf8").split(/\r?\n/));
  // Fall back to the curated UZ starter list when nothing was passed.
  if (!csv && !file) {
    out.push(...UZ_TELEGRAM);
    console.log(`No --channels/--file given — using ${UZ_TELEGRAM.length} curated UZ channels.`);
  }
  // Normalize: strip @, full URLs, whitespace; dedupe.
  const norm = out
    .map((s) =>
      s
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/(t\.me|telegram\.me)\/(s\/)?/i, ""),
    )
    .map((s) => s.replace(/\/.*$/, ""))
    .filter(Boolean);
  return [...new Set(norm)];
}

function parseCount(raw) {
  const s = String(raw).trim().replace(/ /g, " ");
  const m = s.match(/([\d.,\s]+)\s*([KMB])?/i);
  if (!m) return 0;
  let n = parseFloat(m[1].replace(/[\s,]/g, ""));
  const suf = (m[2] || "").toUpperCase();
  if (suf === "K") n *= 1e3;
  else if (suf === "M") n *= 1e6;
  else if (suf === "B") n *= 1e9;
  return Math.round(n || 0);
}

const ogMeta = (html, prop) =>
  html.match(new RegExp(`<meta property="og:${prop}" content="([^"]*)"`, "i"))?.[1] ?? null;

function decode(s) {
  return s
    ? s
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
    : s;
}

// Returns { title, description, avatar, subscribers } or null.
async function fetchTelegram(username) {
  const r = await fetch(`https://t.me/s/${encodeURIComponent(username)}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; InfluenceHubBot/1.0)" },
  });
  if (!r.ok) return null;
  const html = await r.text();

  // Subscriber counter: <span class="counter_value">X</span><span class="counter_type">subscribers</span>
  let subscribers = 0;
  const re =
    /<span class="counter_value">([^<]+)<\/span>\s*<span class="counter_type">([^<]+)<\/span>/g;
  let m;
  while ((m = re.exec(html))) {
    if (/subscriber/i.test(m[2])) {
      subscribers = parseCount(m[1]);
      break;
    }
  }

  const title = decode(ogMeta(html, "title"));
  if (!title) return null; // not a public channel / no preview
  return {
    title,
    description: decode(ogMeta(html, "description")),
    avatar: ogMeta(html, "image"),
    subscribers,
  };
}

async function upsert(username, info, result) {
  if (info.subscribers < 100) return result.skipped++;
  const profileUrl = `https://t.me/${username}`;

  const { data: existing } = await supabase
    .from("social_platforms")
    .select("id, influencer_id")
    .eq("platform", "telegram")
    .eq("profile_url", profileUrl)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("social_platforms")
      .update({ followers_count: info.subscribers })
      .eq("id", existing.id);
    await supabase.from("influencer_analytics_history").insert({
      influencer_id: existing.influencer_id,
      platform: "telegram",
      followers_count: info.subscribers,
      engagement_rate: null,
    });
    return result.updated++;
  }

  const { data: prof, error } = await supabase
    .from("influencer_profiles")
    .insert({
      user_id: null,
      display_name: info.title,
      bio: info.description ? info.description.slice(0, 280) : null,
      category: "entertainment",
      city: null,
      country: COUNTRY,
      is_visible: true,
      avatar_url: info.avatar,
      onboarding_status: "completed",
      engagement_rate: null,
    })
    .select("id")
    .single();
  if (error || !prof) {
    console.warn("  insert failed:", username, error?.message);
    return result.skipped++;
  }

  await supabase.from("social_platforms").insert({
    influencer_id: prof.id,
    platform: "telegram",
    username,
    followers_count: info.subscribers,
    engagement_rate: null,
    profile_url: profileUrl,
    is_primary: true,
  });
  await supabase.from("influencer_analytics_history").insert({
    influencer_id: prof.id,
    platform: "telegram",
    followers_count: info.subscribers,
    engagement_rate: null,
  });
  console.log(`  + ${info.title} (@${username}) — ${info.subscribers.toLocaleString()} subs`);
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
  const channels = loadChannels();
  if (!channels.length) {
    console.error(
      "No channels. Pass --channels=a,b,c or --file=channels.txt (one username per line).",
    );
    process.exit(1);
  }
  console.log(`Scraping ${channels.length} Telegram channel(s) [country=${COUNTRY}]…`);
  const result = { created: 0, updated: 0, skipped: 0 };
  for (const username of channels) {
    try {
      const info = await fetchTelegram(username);
      if (!info) {
        console.warn(`  - @${username}: no public preview / not found`);
        result.skipped++;
        continue;
      }
      await upsert(username, info, result);
    } catch (e) {
      console.warn(`  - @${username} failed: ${e.message}`);
      result.skipped++;
    }
  }
  const ranked = await recomputeRanks();
  console.log(
    `\nDone. created=${result.created} updated=${result.updated} skipped=${result.skipped} ranked=${ranked}`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
