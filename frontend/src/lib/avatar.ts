import type { Platform } from "@/types";

type PlatformRef = { platform: Platform; username: string | null };

/** Instagram handle (without leading @) from a blogger's connected platforms. */
export function instagramHandle(platforms?: PlatformRef[]): string | null {
  const ig = platforms?.find((p) => p.platform === "instagram" && p.username);
  return ig?.username ? ig.username.replace(/^@/, "") : null;
}

// Social sources unavatar.io can resolve a handle → profile picture for.
const UNAVATAR_SOURCES: Platform[] = ["instagram", "youtube", "tiktok", "telegram"];

/**
 * Ordered list of REAL avatar URLs to try for a blogger — only images that come
 * from the blogger's own social presence. No generic/placeholder faces: if none
 * resolve, the caller shows initials instead (never someone else's photo).
 *
 *   1. stored avatar_url (the real social photo already scraped into our data)
 *   2. Instagram handle via unavatar.io (real IG profile picture) — preferred
 *   3. any other connected social (youtube / tiktok / telegram) via unavatar.io
 *
 * unavatar.io fetches the blogger's public social page server-side and returns
 * their current profile picture — doing the "open their page, grab the avatar"
 * step that a browser can't do directly (CORS + auth walls + expiring CDN URLs).
 * `?fallback=false` makes it 404 when there's no real picture, so we fall back
 * to initials rather than a generic silhouette.
 */
export function avatarCandidates(opts: {
  avatarUrl?: string | null;
  platforms?: PlatformRef[];
}): string[] {
  const { avatarUrl, platforms } = opts;
  const out: string[] = [];

  if (avatarUrl) out.push(avatarUrl);

  const ig = instagramHandle(platforms);
  if (ig) out.push(`https://unavatar.io/instagram/${encodeURIComponent(ig)}?fallback=false`);

  for (const src of UNAVATAR_SOURCES) {
    if (src === "instagram") continue;
    const p = platforms?.find((x) => x.platform === src && x.username);
    if (p?.username) {
      const handle = p.username.replace(/^@/, "");
      out.push(`https://unavatar.io/${src}/${encodeURIComponent(handle)}?fallback=false`);
    }
  }

  return out;
}
