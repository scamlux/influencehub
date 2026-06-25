// cache-avatars
// Fetches each blogger's real profile picture from their connected social
// network and stores it permanently in Supabase Storage (bucket `avatars`),
// then points influencer_profiles.avatar_url at that stable public URL.
//
// Why: Instagram/TikTok CDN avatar URLs expire and block hot-linking, so they
// can't be shown directly from the browser. Fetching the bytes SERVER-SIDE
// (no CORS/referrer limits) and caching them fixes this once and for all — and
// guarantees the image is genuinely from the blogger's own social account.
//
// Providers (same secrets as fetch-social-stats):
//   ENSEMBLEDATA_TOKEN — Instagram + TikTok profile picture
//   YOUTUBE_API_KEY    — YouTube channel avatar
//
// Body (all optional):
//   { influencer_id?: string  — cache just this blogger
//     limit?: number          — batch size when no id (default 25)
//     force?: boolean }        — re-cache even if already on our bucket
// Returns: { processed, updated, skipped, failures: [{id, reason}] }

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient } from "../_shared/client.ts";

const ED_TOKEN = Deno.env.get("ENSEMBLEDATA_TOKEN") ?? "";
const YT_KEY = Deno.env.get("YOUTUBE_API_KEY") ?? Deno.env.get("YOUTUBE_DATA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const BUCKET = "avatars";

// Pull the first non-empty string from a list of possible response shapes.
function firstUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("http")) return c;
    if (Array.isArray(c) && typeof c[0] === "string" && c[0].startsWith("http")) return c[0];
  }
  return null;
}

async function instagramPic(username: string): Promise<string | null> {
  if (!ED_TOKEN) return null;
  const u = username.replace(/^@/, "");
  const r = await fetch(
    `https://ensembledata.com/apis/instagram/user/info?username=${encodeURIComponent(u)}&token=${ED_TOKEN}`,
  );
  const d = await r.json();
  const data = d?.data ?? d;
  return firstUrl(data?.profile_pic_url_hd, data?.profile_pic_url, data?.profile_picture);
}

async function tiktokPic(username: string): Promise<string | null> {
  if (!ED_TOKEN) return null;
  const u = username.replace(/^@/, "");
  const r = await fetch(
    `https://ensembledata.com/apis/tt/user/info-from-username?username=${encodeURIComponent(u)}&token=${ED_TOKEN}`,
  );
  const d = await r.json();
  const user = d?.data?.user ?? d?.data ?? d;
  return firstUrl(
    user?.avatar_larger?.url_list,
    user?.avatarLarger?.urlList,
    user?.avatar_medium?.url_list,
    user?.avatarLarger,
    user?.avatarMedium,
  );
}

async function youtubePic(username: string): Promise<string | null> {
  if (!YT_KEY) return null;
  const handle = username.replace(/^@/, "");
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${handle}&key=${YT_KEY}`,
  );
  const d = await r.json();
  const t = d?.items?.[0]?.snippet?.thumbnails;
  return firstUrl(t?.high?.url, t?.medium?.url, t?.default?.url);
}

// Resolve a real profile picture, preferring Instagram, then TikTok, YouTube.
async function resolvePic(
  platforms: { platform: string; username: string | null }[],
): Promise<string | null> {
  const byPlatform = (p: string) => platforms.find((x) => x.platform === p && x.username)?.username;
  const order: [string, (u: string) => Promise<string | null>][] = [
    ["instagram", instagramPic],
    ["tiktok", tiktokPic],
    ["youtube", youtubePic],
  ];
  for (const [platform, fn] of order) {
    const handle = byPlatform(platform);
    if (!handle) continue;
    try {
      const url = await fn(handle);
      if (url) return url;
    } catch (e) {
      console.error(`resolvePic ${platform}/${handle}: ${e}`);
    }
  }
  return null;
}

const ON_BUCKET = `/storage/v1/object/public/${BUCKET}/`;

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const { influencer_id, force = false } = body as {
      influencer_id?: string;
      force?: boolean;
    };
    const limit = Math.min(Number(body?.limit ?? 25), 100);

    const admin = adminClient();

    // Build the working set: one blogger, or a batch still missing a cached avatar.
    let targets: { id: string }[] = [];
    if (influencer_id) {
      targets = [{ id: influencer_id }];
    } else {
      const { data, error } = await admin
        .from("influencer_profiles")
        .select("id, avatar_url")
        .order("league_rank", { ascending: true, nullsFirst: false })
        .limit(500);
      if (error) return json({ error: error.message }, 500);
      targets = (data ?? [])
        .filter((r) => force || !r.avatar_url || !r.avatar_url.includes(ON_BUCKET))
        .slice(0, limit)
        .map((r) => ({ id: r.id }));
    }

    let updated = 0;
    let skipped = 0;
    const failures: { id: string; reason: string }[] = [];

    for (const { id } of targets) {
      try {
        const { data: platforms } = await admin
          .from("social_platforms")
          .select("platform, username")
          .eq("influencer_id", id);

        const picUrl = await resolvePic(platforms ?? []);
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

        // Stable public URL (cache-bust so updated photos refresh on clients).
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

    return json({ processed: targets.length, updated, skipped, failures });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
