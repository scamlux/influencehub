import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cyrillic → Latin map so search matches regardless of script
// ("Азода" ↔ "Azoda", "Юсупахмет" ↔ "Yusupakhmet"). Covers Russian plus the
// extra Uzbek/Kazakh/Kyrgyz letters that appear in our blogger names.
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ғ: "g", қ: "q", ҳ: "h", ў: "o", ҷ: "j", ҙ: "z", ң: "ng", ү: "u", ұ: "u",
  һ: "h", ә: "a", ө: "o", і: "i",
};

// Normalize a name/query for script-agnostic, accent-insensitive comparison.
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics (é → e)
    .replace(/[а-яёғқҳўҷҙңүұһәөі]/g, (ch) => TRANSLIT[ch] ?? ch)
    .replace(/[^a-z0-9]/g, ""); // drop spaces/punctuation so "azoda y" ≈ "azoday"
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return `${n}`;
}

// Engagement rate for display: "4.2%" or "—" when it hasn't been collected yet
// (e.g. a profile the social provider didn't return). Never renders a bare "%".
export function formatEr(er: number | null | undefined): string {
  return er != null ? `${er.toFixed(1)}%` : "—";
}

export function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  const intervals: [number, string][] = [
    [31536000, "y"],
    [2592000, "mo"],
    [86400, "d"],
    [3600, "h"],
    [60, "m"],
  ];
  for (const [secs, label] of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) return `${count}${label} ago`;
  }
  return "just now";
}

export function formatDate(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function uid(): string {
  return crypto.randomUUID();
}
