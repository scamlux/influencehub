// cache-avatars
// Fetches each blogger's real profile picture from their social network and
// stores it permanently in Supabase Storage (bucket `avatars`), then points
// influencer_profiles.avatar_url at that stable public URL.
//
// Why: Instagram/TikTok CDN avatar URLs expire and block hot-linking, so they
// can't be shown directly from the browser. We fetch them SERVER-SIDE and cache
// the bytes — fixing it permanently, and guaranteeing the photo is genuinely
// from the blogger's own account.
//
// Providers:
//   APIFY_API_KEY      — Instagram profile scraper (reliable, bypasses IG blocks)
//   YOUTUBE_API_KEY    — YouTube channel avatar (fallback for YT-only bloggers)
//
// Body (all optional):
//   { influencer_id?: string  — cache just this blogger
//     limit?: number          — batch size when no id (default 20, max 40)
//     force?: boolean }        — re-cache even if already on our bucket
// Returns: { processed, updated, skipped, failures: [{id, reason}] }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";

const APIFY = Deno.env.get("APIFY_API_KEY") ?? "";
const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? Deno.env.get("YOUTUBE_DATA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BUCKET = "avatars";
const ON_BUCKET = `/storage/v1/object/public/${BUCKET}/`;

const clean = (u: string) => u.replace(/^@/, "").trim().toLowerCase();

// Resolve Instagram avatars for many handles in a single Apify run.
async function instagramPics(handles: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!APIFY || handles.length === 0) return map;
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?token=${APIFY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: handles }),
    },
  );
  if (!res.ok) {
    console.error(`apify ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return map;
  }
  const items = await res.json();
  for (const it of Array.isArray(items) ? items : []) {
    const u = typeof it?.username === "string" ? it.username.toLowerCase() : null;
    const pic = it?.profilePicUrlHD || it?.profilePicUrl;
    if (u && typeof pic === "string") map[u] = pic;
  }
  return map;
}

async function youtubePic(handle: string): Promise<string | null> {
  if (!YT_KEY) return null;
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${clean(handle)}&key=${YT_KEY}`,
  );
  const d = await r.json();
  const t = d?.items?.[0]?.snippet?.thumbnails;
  const url = t?.high?.url ?? t?.medium?.url ?? t?.default?.url;
  return typeof url === "string" ? url : null;
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const { influencer_id, force = false } = body as { influencer_id?: string; force?: boolean };
    const limit = Math.min(Number(body?.limit ?? 20), 40);
    const offset = Math.max(0, Number(body?.offset ?? 0));

    const admin = adminClient();
    await admin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    // Working set: one blogger, or a batch still missing a cached avatar.
    // `existing` keeps each target's current avatar_url so we can simply re-host
    // a fresh CDN URL (written by the daily refresh) without re-hitting Apify.
    const existing = new Map<string, string | null>();
    if (influencer_id) {
      const { data } = await admin
        .from("influencer_profiles")
        .select("avatar_url")
        .eq("id", influencer_id)
        .maybeSingle();
      existing.set(influencer_id, data?.avatar_url ?? null);
    } else {
      const { data, error } = await admin
        .from("influencer_profiles")
        .select("id, avatar_url")
        .order("league_rank", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) return json({ error: error.message }, 500);
      const matching = (data ?? []).filter(
        (r) => force || !r.avatar_url || !r.avatar_url.includes(ON_BUCKET),
      );
      for (const r of matching.slice(offset, offset + limit)) {
        existing.set(r.id, r.avatar_url ?? null);
      }
    }
    const targetIds = [...existing.keys()];
    if (targetIds.length === 0) return json({ processed: 0, updated: 0, skipped: 0, failures: [] });

    // A usable, already-fetched photo URL we can just re-host (not on our bucket).
    const rehostUrl = (id: string) => {
      const u = existing.get(id);
      return u && /^https?:\/\//.test(u) && !u.includes(ON_BUCKET) ? u : null;
    };

    // Connected platforms for the whole batch in one query.
    const { data: socials } = await admin
      .from("social_platforms")
      .select("influencer_id, platform, username")
      .in("influencer_id", targetIds);

    const ig = new Map<string, string>(); // influencer_id -> ig handle
    const yt = new Map<string, string>(); // influencer_id -> yt handle
    for (const s of socials ?? []) {
      if (!s.username) continue;
      if (s.platform === "instagram" && !ig.has(s.influencer_id)) ig.set(s.influencer_id, clean(s.username));
      if (s.platform === "youtube" && !yt.has(s.influencer_id)) yt.set(s.influencer_id, clean(s.username));
    }

    // Only resolve via Apify for bloggers without an already-fetched URL to re-host.
    const needApify = targetIds.filter((id) => !rehostUrl(id) && ig.has(id)).map((id) => ig.get(id)!);
    const igMap = await instagramPics([...new Set(needApify)]);

    let updated = 0;
    let skipped = 0;
    const failures: { id: string; reason: string }[] = [];

    for (const id of targetIds) {
      try {
        // Prefer re-hosting an already-fetched URL; else resolve fresh.
        let picUrl: string | null = rehostUrl(id);
        const igHandle = ig.get(id);
        if (!picUrl && igHandle && igMap[igHandle]) picUrl = igMap[igHandle];
        if (!picUrl && yt.has(id)) picUrl = await youtubePic(yt.get(id)!);
        if (!picUrl) {
          skipped++;
          continue;
        }

        const imgRes = await fetch(picUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!imgRes.ok) {
          failures.push({ id, reason: `image fetch ${imgRes.status}` });
          continue;
        }
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
        const bytes = new Uint8Array(await imgRes.arrayBuffer());
        const path = `${id}.${ext}`;

        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(path, bytes, { contentType, upsert: true });
        if (upErr) {
          failures.push({ id, reason: `upload: ${upErr.message}` });
          continue;
        }

        const publicUrl = `${SUPABASE_URL}${ON_BUCKET}${path}?v=${Date.now()}`;
        const { error: updErr } = await admin
          .from("influencer_profiles")
          .update({ avatar_url: publicUrl })
          .eq("id", id);
        if (updErr) {
          failures.push({ id, reason: `db: ${updErr.message}` });
          continue;
        }
        updated++;
      } catch (e) {
        failures.push({ id, reason: String(e) });
      }
    }

    return json({ processed: targetIds.length, updated, skipped, failures });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
