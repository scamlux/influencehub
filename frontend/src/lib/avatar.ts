// Avatars are cached server-side into Supabase Storage (see the cache-avatars
// edge function). The browser must only ever request those stable, always-2xx
// URLs — raw social CDN links (Instagram/TikTok) are signed + expire, so an
// <img> pointing at them throws a 403/404 that Chrome logs as a console error
// (which also fails Lighthouse "no browser errors"). So we trust ONLY our
// bucket URL or an inline data: upload; anything else falls back to initials.

const BUCKET_MARKER = "/storage/v1/object/public/avatars/";

/** Returns the avatar URL to render, or null to show initials. */
export function avatarCandidates(opts: { avatarUrl?: string | null }): string[] {
  const url = opts.avatarUrl;
  if (url && (url.includes(BUCKET_MARKER) || url.startsWith("data:"))) {
    return [url];
  }
  return [];
}
