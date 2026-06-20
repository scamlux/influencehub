// Curated Uzbekistan starter lists used by the discovery scripts when you don't
// pass --channels / --users. These are best-effort handles for major UZ media &
// creators — VERIFY and expand them for your needs. Non-resolving entries are
// skipped automatically.
//
// ⚠️  Apify (Instagram/TikTok) is PAID — keep those lists tight and confirm the
// handles before large runs so you don't spend credits on wrong usernames.
// Telegram scraping is free, so that list can be longer.

// Public Telegram channels (news / media with web preview at t.me/s/<name>).
export const UZ_TELEGRAM = [
  "kunuz", // Kun.uz
  "gazetauz", // Gazeta.uz
  "daryo_uz", // Daryo
  "qalampir_uz", // Qalampir.uz
  "repost_uz", // Repost.uz
  "zamon_uz", // Zamon.uz
  "uznews", // UzNews
  "xs_uz", // Xabar Service
  "mover_uz", // Mover.uz
  "sportuzofficial",
];

// Instagram handles (mostly UZ media brands — more predictable than individuals).
export const UZ_INSTAGRAM = ["kun.uz", "gazeta.uz", "daryo.uz", "qalampir.uz", "repost.uz"];

// TikTok handles.
export const UZ_TIKTOK = ["kun.uz", "daryo.uz"];
