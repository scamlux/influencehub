import { useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, GitCompare, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/common";
import { InfluencerRow } from "./InfluencerRow";
import { useLanguage } from "@/hooks/useLanguage";
import { useCompare } from "@/hooks/useCompare";
import { normalizeSearch } from "@/lib/utils";
import type { Category, InfluencerFull, Platform } from "@/types";

const PAGE_SIZE = 10;
// Accounts below this follower count are kept out of the top of the
// "By Engagement" sort — a 100% rate on 30 followers is noise, not a signal.
const ENGAGEMENT_MIN_FOLLOWERS = 10_000;
const CATEGORIES: Category[] = [
  "food",
  "tech",
  "fashion",
  "lifestyle",
  "education",
  "travel",
  "beauty",
  "sports",
  "entertainment",
  "business",
  "auto",
];
const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "telegram"];
const COUNTRY_NAMES: Record<string, string> = {
  UZ: "Uzbekistan",
  KZ: "Kazakhstan",
  RU: "Russia",
  KG: "Kyrgyzstan",
  TJ: "Tajikistan",
  TM: "Turkmenistan",
  US: "United States",
  GB: "United Kingdom",
  TR: "Türkiye",
  AE: "UAE",
};
const countryName = (c: string) => COUNTRY_NAMES[c] ?? c;

type Sort = "by_rank" | "by_followers" | "by_engagement" | "by_price";
const SORTS: Sort[] = ["by_rank", "by_followers", "by_engagement", "by_price"];

function minPrice(inf: InfluencerFull): number {
  if (!inf.prices.length) return Infinity;
  return Math.min(...inf.prices.map((p) => p.price_usd));
}

export function LeagueView({
  influencers,
  profileLinkBase,
  enableCompare = false,
}: {
  influencers: InfluencerFull[];
  profileLinkBase: string;
  enableCompare?: boolean;
}) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  // Filters/sort/page live in the URL so they survive navigating into a profile
  // and back (browser back restores the exact list state). (#15)
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const sort = (SORTS.includes(params.get("sort") as Sort) ? params.get("sort") : "by_rank") as Sort;
  const platform = params.get("platform") ?? "all";
  const category = params.get("category") ?? "all";
  const city = params.get("city") ?? "all";
  const country = params.get("country") ?? "all";
  const page = Math.max(0, Number(params.get("page") ?? "0") | 0);
  const { selected, toggle: toggleSelect, clear: clearSelected, isSelected } = useCompare();
  const tableRef = useRef<HTMLDivElement>(null);

  // Merge a set of param changes; clearing back to defaults drops the key so the
  // URL stays clean. Any filter/search change resets to page 0.
  function patch(next: Record<string, string>, resetPage = true) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(next)) {
          if (!v || v === "all" || (k === "page" && v === "0")) p.delete(k);
          else p.set(k, v);
        }
        if (resetPage && !("page" in next)) p.delete("page");
        return p;
      },
      { replace: true },
    );
  }

  const cities = useMemo(
    () => Array.from(new Set(influencers.map((i) => i.city).filter(Boolean))) as string[],
    [influencers],
  );
  const countries = useMemo(
    () => Array.from(new Set(influencers.map((i) => i.country).filter(Boolean))) as string[],
    [influencers],
  );

  // How many bloggers are on each platform — powers the dropdown counts and lets
  // us flag platforms with no data as "coming soon" instead of a dead filter. (#8)
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of PLATFORMS) counts[p] = 0;
    for (const inf of influencers)
      for (const p of new Set(inf.platforms.map((x) => x.platform)))
        if (p in counts) counts[p] += 1;
    return counts;
  }, [influencers]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search);
    let list = influencers.filter((i) => {
      // Script-agnostic match: "Азода" finds "Azoda" and vice-versa. (#5)
      if (q && !normalizeSearch(i.display_name).includes(q)) return false;
      if (platform !== "all" && !i.platforms.some((p) => p.platform === platform)) return false;
      if (category !== "all" && i.category !== category) return false;
      if (city !== "all" && i.city !== city) return false;
      if (country !== "all" && i.country !== country) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "by_followers":
          return b.total_followers - a.total_followers;
        case "by_engagement": {
          // Eligible (≥ floor) accounts always rank above sub-floor ones, so a
          // 6-follower / 100% account can't sit at the top. (#6)
          const aOk = a.total_followers >= ENGAGEMENT_MIN_FOLLOWERS ? 0 : 1;
          const bOk = b.total_followers >= ENGAGEMENT_MIN_FOLLOWERS ? 0 : 1;
          if (aOk !== bOk) return aOk - bOk;
          return (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0);
        }
        case "by_price":
          // Cheapest public price first; profiles without public pricing last. (#7)
          return minPrice(a) - minPrice(b);
        default:
          return (a.league_rank ?? 999) - (b.league_rank ?? 999);
      }
    });
    return list;
  }, [influencers, search, platform, category, city, country, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const current = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // On page change, bring the top of the table into view so the user starts at
  // the beginning of the new page rather than stranded at the bottom. (#3)
  const didMount = useRef(false);
  useEffect(() => {
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [safePage]);

  const sortHint = t(`league.sortHint.${sort}`);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => patch({ q: e.target.value })}
            placeholder={t("league.search")}
            className="pl-9 dark:bg-input dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          <Select value={sort} onValueChange={(v) => patch({ sort: v }, false)}>
            <SelectTrigger className="min-w-0 dark:bg-card dark:border-border dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="by_rank">{t("league.sortByRank")}</SelectItem>
              <SelectItem value="by_followers">{t("league.sortByFollowers")}</SelectItem>
              <SelectItem value="by_engagement">{t("league.sortByEngagement")}</SelectItem>
              <SelectItem value="by_price">{t("league.sortByPrice")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platform} onValueChange={(v) => patch({ platform: v })}>
            <SelectTrigger className="min-w-0 dark:bg-card dark:border-border dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("league.allPlatforms")}</SelectItem>
              {PLATFORMS.map((p) => {
                const count = platformCounts[p] ?? 0;
                return (
                  <SelectItem key={p} value={p} disabled={count === 0}>
                    {t(`platform.${p}`)}
                    {count === 0 ? ` · ${t("league.comingSoon")}` : ` (${count})`}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={(v) => patch({ category: v })}>
            <SelectTrigger className="min-w-0 dark:bg-card dark:border-border dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("league.allCategories")}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`category.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={(v) => patch({ country: v })}>
            <SelectTrigger className="min-w-0 dark:bg-card dark:border-border dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("league.allCountries")}</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {countryName(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={city} onValueChange={(v) => patch({ city: v })}>
            <SelectTrigger className="min-w-0 dark:bg-card dark:border-border dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("league.allCities")}</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Explains the active ordering so "By Price"/"By Engagement" results
          aren't perceived as random. (#7) */}
      {sortHint && <p className="mb-3 text-xs text-muted-foreground">{sortHint}</p>}

      {enableCompare && selected.length > 0 && (
        <div className="sticky top-16 z-20 mb-4 flex items-center justify-between gap-3 rounded-lg border bg-primary/5 px-4 py-3 shadow-sm backdrop-blur">
          <span className="text-sm font-medium">
            {selected.length} {t("compare.selected")} ({t("compare.max")})
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelected}>
              {t("compare.clear")}
            </Button>
            <Button size="sm" onClick={() => navigate(`/brand/compare?ids=${selected.join(",")}`)}>
              <GitCompare className="h-4 w-4" />
              {t("league.compare")} ({selected.length})
            </Button>
          </div>
        </div>
      )}

      <div ref={tableRef} className="scroll-mt-20 rounded-xl border bg-card">
        {current.length === 0 ? (
          <EmptyState icon={Users} title={t("league.noResults")} />
        ) : (
          current.map((inf, i) => (
            <InfluencerRow
              key={inf.id}
              influencer={inf}
              position={safePage * PAGE_SIZE + i + 1}
              profileLink={`${profileLinkBase}/${inf.id}`}
              selectable={enableCompare}
              selected={isSelected(inf.id)}
              onToggleSelect={() => toggleSelect(inf.id)}
            />
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={safePage === 0}
            onClick={() => patch({ page: String(safePage - 1) }, false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {safePage + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={safePage >= pageCount - 1}
            onClick={() => patch({ page: String(safePage + 1) }, false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
