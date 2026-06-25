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
 * Ordered list of avatar URLs to try for a blogger. Resolves in priority order
 * and ALWAYS ends with a deterministic photo, so every blogger shows a face:
 *   1. stored avatar_url (the real social photo already in our data)
 *   2. Instagram handle via unavatar.io (real IG profile picture) — preferred
 *   3. any other connected social (youtube / tiktok / telegram) via unavatar.io
 *   4. deterministic placeholder face (i.pravatar.cc) — never 404s
 *
 * `?fallback=false` makes unavatar return 404 (instead of a generic silhouette)
 * when a handle has no picture, so the chain advances to the next candidate.
 */
export function avatarCandidates(opts: {
  avatarUrl?: string | null;
  platforms?: PlatformRef[];
  seed?: string;
  name?: string;
}): string[] {
  const { avatarUrl, platforms, seed, name } = opts;
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

  // Deterministic, always-resolvable face so no blogger is ever avatar-less.
  const key = (seed || name || "anon").toString();
  out.push(`https://i.pravatar.cc/300?u=${encodeURIComponent(key)}`);

  return out;
}
