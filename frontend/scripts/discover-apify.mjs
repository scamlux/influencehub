// Pull REAL Instagram / TikTok creator stats via Apify actors and upsert them
// as influencers in Supabase. Apify is paid (you have an account/key).
//
// Run from frontend/:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
//   APIFY_API_KEY=apify_api_... \
//   node scripts/discover-apify.mjs --platform=instagram --users=user1,user2 [--country=UZ]
//   node scripts/discover-apify.mjs --platform=tiktok --file=users.txt
//
// Apify actor output shapes differ by actor/version — if followers come back 0,
// the script logs a sample item so you can adjust the field mapping (or pass a
// different actor with --actor=owner~actor-name). Node 18+. Service-role = local only.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { UZ_INSTAGRAM, UZ_TIKTOK } from "./uz-starter.mjs";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_TOKEN = process.env.APIFY_API_KEY || process.env.APIFY_TOKEN;
if (!SUPABASE_URL || !SERVICE_KEY || !APIFY_TOKEN) {
  console.error("Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APIFY_API_KEY.");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const argVal = (name) => {
  const m = process.argv.find((a) => a.startsWith(`--${name}=`));
  return m ? m.split("=")[1] : undefined;
};
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
};

const PLATFORM = (argVal("platform") || "instagram").toLowerCase();
const COUNTRY = (argVal("country") || "UZ").toUpperCase();

// Default actors + how to build their input and read their output. Override the
// actor with --actor=owner~name if yours differs.
const CONFIG = {
  instagram: {
    actor: "apify~instagram-profile-scraper",
    starter: UZ_INSTAGRAM,
    input: (users) => ({ usernames: users }),
    map: (it) => ({
      username: it.username ?? it.ownerUsername ?? null,
      displayName: it.fullName || it.username || null,
      followers: num(it.followersCount ?? it.followers ?? it.followersCountNumber),
      bio: it.biography ?? null,
      avatar: it.profilePicUrlHD ?? it.profilePicUrl ?? null,
      url: it.url ?? (it.username ? `https://instagram.com/${it.username}` : null),
    }),
  },
  tiktok: {
    actor: "clockworks~tiktok-profile-scraper",
    starter: UZ_TIKTOK,
    input: (users) => ({ profiles: users, resultsPerPage: 1, shouldDownloadVideos: false }),
    map: (it) => {
      const a = it.authorMeta ?? it.author ?? it.user ?? it;
      const username = a.name ?? a.uniqueId ?? a.username ?? it.input ?? null;
      return {
        username,
        displayName: a.nickName ?? a.nickname ?? a.fullName ?? username,
        followers: num(a.fans ?? a.followers ?? a.followerCount ?? a.followersCount ?? it.fans),
        bio: a.signature ?? a.bio ?? null,
        avatar: a.avatar ?? a.avatarMedium ?? a.avatarThumb ?? null,
        url: username ? `https://tiktok.com/@${username}` : null,
      };
    },
  },
};

const cfg = CONFIG[PLATFORM];
if (!cfg) {
  console.error(`Unsupported --platform=${PLATFORM} (use instagram or tiktok).`);
  process.exit(1);
}
const ACTOR = argVal("actor") || cfg.actor;

function loadUsers() {
  const out = [];
  const csv = argVal("users");
  if (csv) out.push(...csv.split(","));
  const file = argVal("file");
  if (file) out.push(...readFileSync(file, "utf8").split(/\r?\n/));
  // Fall back to the curated UZ starter list for this platform (Apify is PAID).
  if (!csv && !file) {
    out.push(...(cfg.starter ?? []));
    if (out.length) {
      console.log(
        `No --users/--file given — using ${out.length} curated UZ ${PLATFORM} handles ` +
          `(Apify is paid; verify before large runs).`,
      );
    }
  }
  const norm = out
    .map((s) =>
      s
        .trim()
        .replace(/^@/, "")
        .replace(/^https?:\/\/[^/]+\/(@)?/i, ""),
    )
    .map((s) => s.replace(/[/?].*$/, ""))
    .filter(Boolean);
  return [...new Set(norm)];
}

async function runActor(users) {
  const url = `https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg.input(users)),
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Apify ${r.status}: ${body.slice(0, 300)}`);
  }
  return r.json(); // array of dataset items
}

async function upsert(rec, result) {
  if (!rec.username || rec.followers < 100) return result.skipped++;
  const profileUrl = rec.url ?? `https://${PLATFORM}.com/${rec.username}`;

  const { data: existing } = await supabase
    .from("social_platforms")
    .select("id, influencer_id")
    .eq("platform", PLATFORM)
    .eq("profile_url", profileUrl)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("social_platforms")
      .update({ followers_count: rec.followers })
      .eq("id", existing.id);
    await supabase.from("influencer_analytics_history").insert({
      influencer_id: existing.influencer_id,
      platform: PLATFORM,
      followers_count: rec.followers,
      engagement_rate: null,
    });
    return result.updated++;
  }

  const { data: prof, error } = await supabase
    .from("influencer_profiles")
    .insert({
      user_id: null,
      display_name: rec.displayName || rec.username,
      bio: rec.bio ? String(rec.bio).slice(0, 280) : null,
      category: "lifestyle",
      city: null,
      country: COUNTRY,
      is_visible: true,
      avatar_url: rec.avatar,
      onboarding_status: "completed",
      engagement_rate: null,
    })
    .select("id")
    .single();
  if (error || !prof) {
    console.warn("  insert failed:", rec.username, error?.message);
    return result.skipped++;
  }

  await supabase.from("social_platforms").insert({
    influencer_id: prof.id,
    platform: PLATFORM,
    username: rec.username,
    followers_count: rec.followers,
    engagement_rate: null,
    profile_url: profileUrl,
    is_primary: true,
  });
  await supabase.from("influencer_analytics_history").insert({
    influencer_id: prof.id,
    platform: PLATFORM,
    followers_count: rec.followers,
    engagement_rate: null,
  });
  console.log(
    `  + ${rec.displayName} (@${rec.username}) — ${rec.followers.toLocaleString()} followers`,
  );
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
  const users = loadUsers();
  if (!users.length) {
    console.error("No users. Pass --users=a,b,c or --file=users.txt.");
    process.exit(1);
  }
  console.log(`Apify ${PLATFORM} (${ACTOR}) — ${users.length} profile(s), country=${COUNTRY}…`);

  const items = await runActor(users);
  if (!Array.isArray(items) || !items.length) {
    console.log("Actor returned no items.");
    return;
  }

  // Map → records, then collapse to one record per username (highest followers).
  const byUser = new Map();
  for (const it of items) {
    const rec = cfg.map(it);
    if (!rec.username) continue;
    const key = rec.username.toLowerCase();
    const prev = byUser.get(key);
    if (!prev || rec.followers > prev.followers) byUser.set(key, rec);
  }

  if (![...byUser.values()].some((r) => r.followers > 0)) {
    console.warn(
      "\n⚠️  No follower counts parsed — the actor's output shape may differ.\n" +
        "Sample item (adjust the map() in CONFIG or use --actor=):",
    );
    console.dir(items[0], { depth: 4 });
  }

  const result = { created: 0, updated: 0, skipped: 0 };
  for (const rec of byUser.values()) await upsert(rec, result);

  const ranked = await recomputeRanks();
  console.log(
    `\nDone. created=${result.created} updated=${result.updated} skipped=${result.skipped} ranked=${ranked}`,
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
