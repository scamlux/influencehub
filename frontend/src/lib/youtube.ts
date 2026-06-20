// Real YouTube channel stats, fetched client-side from the YouTube Data API v3.
// Set VITE_YOUTUBE_API_KEY (restrict it by HTTP referrer in Google Cloud — it
// ships in the browser bundle). Returns null when no key or no channel found,
// so callers can fall back gracefully.

const KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

export interface YouTubeStats {
  followers: number;
  engagement: number;
  avatar: string | null;
  country: string | null;
  channelUrl: string | null;
}

async function firstItem(url: string): Promise<any | null> {
  try {
    const r = await fetch(url);
    const d = await r.json();
    if (d.error) return null;
    return d.items?.[0] ?? null;
  } catch {
    return null;
  }
}

/** Look up a channel by @handle, legacy username, or free-text search. */
export async function fetchYouTubeStats(input: string): Promise<YouTubeStats | null> {
  if (!KEY) return null;
  const handle = input.replace(/^@/, "").trim();
  if (!handle) return null;
  const base = "https://www.googleapis.com/youtube/v3";
  const part = "part=statistics,snippet";

  let item =
    (await firstItem(
      `${base}/channels?${part}&forHandle=@${encodeURIComponent(handle)}&key=${KEY}`,
    )) ??
    (await firstItem(
      `${base}/channels?${part}&forUsername=${encodeURIComponent(handle)}&key=${KEY}`,
    ));

  if (!item) {
    const hit = await firstItem(
      `${base}/search?part=snippet&type=channel&maxResults=1&q=${encodeURIComponent(handle)}&key=${KEY}`,
    );
    const channelId = hit?.id?.channelId ?? hit?.snippet?.channelId;
    if (channelId) item = await firstItem(`${base}/channels?${part}&id=${channelId}&key=${KEY}`);
  }
  if (!item) return null;

  const subs = Number(item.statistics?.subscriberCount ?? 0);
  const views = Number(item.statistics?.viewCount ?? 0);
  const videos = Number(item.statistics?.videoCount ?? 1);
  const engagement = subs
    ? Math.round(Math.min(100, (views / Math.max(videos, 1) / subs) * 100) * 100) / 100
    : 0;

  return {
    followers: subs,
    engagement,
    avatar: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url ?? null,
    country: item.snippet?.country ?? null,
    channelUrl: item.id ? `https://youtube.com/channel/${item.id}` : null,
  };
}

export const hasYouTubeKey = !!KEY;
