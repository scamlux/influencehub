import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import type { Category, InfluencerFull, Platform } from "@/types";

const PAGE_SIZE = 10;
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
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("by_rank");
  const [platform, setPlatform] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [city, setCity] = useState<string>("all");
  const [country, setCountry] = useState<string>("all");
  const [page, setPage] = useState(0);
  const { selected, toggle: toggleSelect, clear: clearSelected, isSelected } = useCompare();

  const cities = useMemo(
    () => Array.from(new Set(influencers.map((i) => i.city).filter(Boolean))) as string[],
    [influencers],
  );
  const countries = useMemo(
    () => Array.from(new Set(influencers.map((i) => i.country).filter(Boolean))) as string[],
    [influencers],
  );

  const filtered = useMemo(() => {
    let list = influencers.filter((i) => {
      if (search && !i.display_name.toLowerCase().includes(search.toLowerCase())) return false;
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
        case "by_engagement":
          return (b.engagement_rate ?? 0) - (a.engagement_rate ?? 0);
        case "by_price":
          return minPrice(a) - minPrice(b);
        default:
          return (a.league_rank ?? 999) - (b.league_rank ?? 999);
      }
    });
    return list;
  }, [influencers, search, platform, category, city, country, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={t("league.search")}
            className="pl-9 dark:bg-input dark:border-border dark:text-foreground dark:placeholder:text-muted-foreground"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
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
          <Select
            value={platform}
            onValueChange={(v) => {
              setPlatform(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="min-w-0 dark:bg-card dark:border-border dark:text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("league.allPlatforms")}</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`platform.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
          >
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
          <Select
            value={country}
            onValueChange={(v) => {
              setCountry(v);
              setPage(0);
            }}
          >
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
          <Select
            value={city}
            onValueChange={(v) => {
              setCity(v);
              setPage(0);
            }}
          >
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

      <div className="rounded-xl border bg-card">
        {current.length === 0 ? (
          <EmptyState icon={Users} title={t("league.noResults")} />
        ) : (
          current.map((inf) => (
            <InfluencerRow
              key={inf.id}
              influencer={inf}
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
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page + 1} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
