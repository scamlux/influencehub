// Generates public/sitemap.xml before the build.
// Static pages + all visible blogger profiles fetched from Supabase (anon, RLS-limited).
// On fetch failure the sitemap falls back to static pages only (build never fails).
import { readFileSync, writeFileSync } from "node:fs";

const SITE = "https://famic.vercel.app";

// Prefer real env (Vercel build); fall back to .env / .env.example for local runs.
function envFromFiles(name) {
  for (const file of ["../.env", "../.env.example"]) {
    try {
      const text = readFileSync(new URL(file, import.meta.url), "utf8");
      const match = text.match(new RegExp(`^${name}=(.+)$`, "m"));
      if (match) return match[1].trim();
    } catch {
      // file missing — try next
    }
  }
  return undefined;
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || envFromFiles("VITE_SUPABASE_URL");
const ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || envFromFiles("VITE_SUPABASE_ANON_KEY");

const staticUrls = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/league", changefreq: "daily", priority: "0.9" },
  { loc: "/pricing", changefreq: "monthly", priority: "0.7" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
];

let bloggerUrls = [];
try {
  if (!SUPABASE_URL || !ANON_KEY) throw new Error("missing Supabase env");
  const url =
    `${SUPABASE_URL}/rest/v1/influencer_profiles` +
    `?select=id&is_visible=eq.true&order=league_rank.asc.nullslast&limit=1000`;
  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = await res.json();
  bloggerUrls = rows
    .filter((r) => typeof r.id === "string" && r.id.length > 0)
    .map((r) => ({ loc: `/blogger/${r.id}`, changefreq: "weekly", priority: "0.6" }));
  console.log(`sitemap: fetched ${bloggerUrls.length} visible bloggers`);
} catch (err) {
  console.warn(`sitemap: bloggers fetch failed (${err.message}); static entries only`);
}

const entry = ({ loc, changefreq, priority }) =>
  [
    "  <url>",
    `    <loc>${SITE}${loc}</loc>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ].join("\n");

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...staticUrls.map(entry),
  ...bloggerUrls.map(entry),
  "</urlset>",
  "",
].join("\n");

writeFileSync(new URL("../public/sitemap.xml", import.meta.url), xml);
console.log(`sitemap: wrote ${staticUrls.length + bloggerUrls.length} URLs to public/sitemap.xml`);
