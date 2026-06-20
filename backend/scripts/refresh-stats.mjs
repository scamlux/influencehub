#!/usr/bin/env node
// refresh-stats.mjs — social-stats + avatar refresh for the real blogger base.
//
// Pulls fresh follower / engagement numbers AND profile pictures for every
// connected platform, writes them back to Supabase, appends an
// influencer_analytics_history row (drives the 30-day growth chart) and re-ranks
// the Blogger League. Avatars are stored on influencer_profiles.avatar_url,
// preferring the influencer's primary platform.
//
//   YouTube     → YouTube Data API v3   (YOUTUBE_API_KEY)
//   Instagram   → Apify instagram-profile-scraper (APIFY_TOKEN)
//   TikTok      → Apify tiktok-scraper            (APIFY_TOKEN)
//
// A platform is only updated when the provider returns a real number; otherwise
// the existing value is kept (we never overwrite real data with placeholders).
//
// This is the same logic the scheduled pg_cron job runs in-database; keep it as
// a manual backfill / debugging tool. Env:
//   SUPABASE_DB_URL, YOUTUBE_API_KEY, APIFY_TOKEN
import pg from "pg";

const DB_URL = process.env.SUPABASE_DB_URL;
const YT_KEY = process.env.YOUTUBE_API_KEY || "";
const APIFY_TOKEN = process.env.APIFY_TOKEN || "";
if (!DB_URL) {
  console.error("SUPABASE_DB_URL is required");
  process.exit(1);
}

// avatar source priority when an influencer has several platforms
const AVATAR_PRIORITY = { instagram: 3, tiktok: 2, youtube: 1 };
const round2 = (n) => Math.round(n * 100) / 100;
const clean = (u) => (u || "").trim().replace(/^@/, "");

// ── YouTube Data API ──────────────────────────────────────────────────────────
async function fetchYouTube(rows) {
  if (!YT_KEY) return new Map();
  const out = new Map(); // sp.id -> {followers, er, avatar}
  for (const r of rows) {
    try {
      const url =
        `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet` +
        `&forHandle=${encodeURIComponent(clean(r.username))}&key=${YT_KEY}`;
      const d = await (await fetch(url)).json();
      const item = d.items?.[0];
      const s = item?.statistics;
      if (!s) continue;
      const followers = Number(s.subscriberCount ?? 0);
      const views = Number(s.viewCount ?? 0);
      const videos = Math.max(Number(s.videoCount ?? 1), 1);
      const er = followers ? round2(Math.min(100, (views / videos / followers) * 100)) : 0;
      const avatar =
        item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null;
      if (followers) out.set(r.id, { followers, er, avatar });
    } catch (e) {
      console.warn(`  youtube ${r.username}: ${e}`);
    }
  }
  return out;
}

// ── Apify (one batch actor run per platform) ──────────────────────────────────
async function runApify(actor, input) {
  const url = `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${APIFY_TOKEN}`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 290000);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`apify ${actor} ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

function instagramEngagement(it) {
  const posts = it.latestPosts;
  const followers = Number(it.followersCount ?? 0);
  if (!Array.isArray(posts) || !posts.length || !followers) return 0;
  let sum = 0,
    n = 0;
  for (const p of posts) {
    const likes = Number(p.likesCount ?? 0);
    const comments = Number(p.commentsCount ?? 0);
    if (likes >= 0) {
      sum += likes + comments;
      n++;
    }
  }
  return n ? round2(Math.min(100, (sum / n / followers) * 100)) : 0;
}

async function fetchInstagram(rows) {
  if (!APIFY_TOKEN || !rows.length) return new Map();
  const byUser = new Map(rows.map((r) => [clean(r.username).toLowerCase(), r.id]));
  const items = await runApify("apify~instagram-profile-scraper", { usernames: [...byUser.keys()] });
  const out = new Map();
  for (const it of items ?? []) {
    const id = byUser.get(clean(it.username).toLowerCase());
    const followers = Number(it.followersCount ?? 0);
    if (!id || !followers) continue;
    out.set(id, {
      followers,
      er: instagramEngagement(it),
      avatar: it.profilePicUrlHD ?? it.profilePicUrl ?? null,
    });
  }
  return out;
}

async function fetchTikTok(rows) {
  if (!APIFY_TOKEN || !rows.length) return new Map();
  const byUser = new Map(rows.map((r) => [clean(r.username).toLowerCase(), r.id]));
  const items = await runApify("clockworks~tiktok-scraper", {
    profiles: [...byUser.keys()],
    resultsPerPage: 1,
    shouldDownloadVideos: false,
    shouldDownloadCovers: false,
    shouldDownloadSubtitles: false,
  });
  const out = new Map();
  for (const it of items ?? []) {
    const m = it.authorMeta;
    if (!m) continue;
    const id = byUser.get(clean(m.name ?? m.nickName).toLowerCase());
    const followers = Number(m.fans ?? 0);
    if (!id || !followers) continue;
    const hearts = Number(m.heart ?? 0);
    const videos = Math.max(Number(m.video ?? 1), 1);
    const er = hearts ? round2(Math.min(100, (hearts / videos / followers) * 100)) : 0;
    if (!out.has(id)) out.set(id, { followers, er, avatar: m.avatar ?? m.originalAvatarUrl ?? null });
  }
  return out;
}

async function main() {
  const c = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const { rows } = await c.query(
    `select sp.id, sp.influencer_id, sp.platform, sp.username, sp.is_primary
       from social_platforms sp where sp.username is not null`,
  );
  const byPlatform = (p) => rows.filter((r) => r.platform === p);
  console.log(
    `loaded ${rows.length} platform rows ` +
      `(yt ${byPlatform("youtube").length}, ig ${byPlatform("instagram").length}, tt ${byPlatform("tiktok").length})`,
  );

  const results = new Map();
  const settle = async (label, p) => {
    try {
      (await p).forEach((v, k) => results.set(k, v));
    } catch (e) {
      console.warn(`${label}: ${e}`);
    }
  };
  await Promise.all([
    settle("youtube", fetchYouTube(byPlatform("youtube"))),
    settle("instagram", fetchInstagram(byPlatform("instagram"))),
    settle("tiktok", fetchTikTok(byPlatform("tiktok"))),
  ]);

  let updated = 0;
  const bestAvatar = new Map(); // influencer_id -> { url, priority }
  for (const r of rows) {
    const fresh = results.get(r.id);
    if (!fresh) continue;
    await c.query(`update social_platforms set followers_count=$1, engagement_rate=$2 where id=$3`, [
      fresh.followers,
      fresh.er || null,
      r.id,
    ]);
    await c.query(
      `insert into influencer_analytics_history (influencer_id, platform, followers_count, engagement_rate)
       values ($1,$2,$3,$4)`,
      [r.influencer_id, r.platform, fresh.followers, fresh.er || null],
    );
    updated++;
    if (fresh.avatar) {
      const pr = AVATAR_PRIORITY[r.platform] ?? 0 + (r.is_primary ? 0.5 : 0);
      const cur = bestAvatar.get(r.influencer_id);
      if (!cur || pr > cur.priority) bestAvatar.set(r.influencer_id, { url: fresh.avatar, priority: pr });
    }
  }

  let avatars = 0;
  for (const [influencer_id, { url }] of bestAvatar) {
    await c.query(`update influencer_profiles set avatar_url=$1 where id=$2`, [url, influencer_id]);
    avatars++;
  }

  // engagement_rate on the profile = its primary platform's ER
  await c.query(`
    update influencer_profiles ip
       set engagement_rate = sp.engagement_rate
      from social_platforms sp
     where sp.influencer_id = ip.id and sp.is_primary = true and sp.engagement_rate is not null`);

  // re-rank the league by total followers
  await c.query(`
    with totals as (
      select ip.id, coalesce(sum(sp.followers_count),0) total
        from influencer_profiles ip
        left join social_platforms sp on sp.influencer_id = ip.id
       where ip.is_visible = true
       group by ip.id
    ), ranked as (
      select id, row_number() over (order by total desc) rn from totals
    )
    update influencer_profiles ip set league_rank = ranked.rn
      from ranked where ranked.id = ip.id`);

  console.log(`refreshed ${updated}/${rows.length} platform rows; ${avatars} avatars; league re-ranked.`);
  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
