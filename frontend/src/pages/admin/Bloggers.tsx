import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Eye, EyeOff, Search, GripVertical, Loader2 } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfluencerAvatar } from "@/components/ui/avatar";
import { PageHeader, PageLoader } from "@/components/common";
import { admin, influencers } from "@/lib/api";
import { USE_MOCK_DATA } from "@/lib/supabase";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { formatNumber, cn } from "@/lib/utils";
import type { InfluencerFull } from "@/types";

const GRID = "grid grid-cols-[2rem_2.5rem_1fr_7rem_6rem_5rem] items-center gap-3 px-4";

function BloggerRow({
  inf,
  rank,
  onToggleVisible,
  onRefresh,
  onCommit,
}: {
  inf: InfluencerFull;
  rank: number;
  onToggleVisible: () => void;
  onRefresh: () => void;
  onCommit: () => void;
}) {
  const { t } = useLanguage();
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={inf}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onCommit}
      className={cn(GRID, "border-b bg-card py-3 text-sm last:border-0")}
      whileDrag={{ scale: 1.01, boxShadow: "var(--shadow-lg)", zIndex: 5 }}
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" focusable="false" />
      </button>
      <span className="text-center font-bold tabular text-muted-foreground">{rank}</span>
      <div className="flex min-w-0 items-center gap-3">
        <InfluencerAvatar
          name={inf.display_name}
          avatarUrl={inf.avatar_url}
          className="h-8 w-8"
          fallbackClassName="text-[11px]"
        />
        <span className="truncate font-medium">{inf.display_name}</span>
      </div>
      <Badge variant="secondary" className="h-5 w-fit px-2 py-0 leading-none">
        {t(`category.${inf.category}`)}
      </Badge>
      <span className="tabular">{formatNumber(inf.total_followers)}</span>
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleVisible} aria-label="Toggle visibility">
          {inf.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRefresh} aria-label="Refresh stats">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

export default function AdminBloggers() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<InfluencerFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  // Order at last successful save — used to compute the minimal set of changes.
  const savedOrder = useRef<string[]>([]);

  const load = () =>
    influencers.listAll().then((d) => {
      const sorted = d.sort((a, b) => (a.league_rank ?? 999) - (b.league_rank ?? 999));
      setItems(sorted);
      savedOrder.current = sorted.map((i) => i.id);
      setLoading(false);
    });
  useEffect(() => {
    load();
  }, []);

  const searching = query.trim().length > 0;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.display_name.toLowerCase().includes(q));
  }, [items, query]);

  // Persist the new order (only rows whose position actually changed).
  const commit = async () => {
    const updates = items
      .map((it, i) => ({ id: it.id, rank: i + 1 }))
      .filter((u) => items[u.rank - 1].id !== savedOrder.current[u.rank - 1]);
    if (!updates.length) return;
    setSaving(true);
    try {
      await admin.reorderInfluencers(updates);
      setItems((prev) => prev.map((it, i) => ({ ...it, league_rank: i + 1 })));
      savedOrder.current = items.map((i) => i.id);
      toast({ title: "Ranking updated", variant: "success" });
    } catch {
      toast({ title: "Couldn't save ranking — reverted", variant: "error" });
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = async (id: string, current: boolean) => {
    await admin.setVisible(id, !current);
    load();
  };
  const refresh = async (id: string) => {
    try {
      // Mock: enqueue this influencer. Live: triggers the scraping worker
      // over already-pending rows (clients can't INSERT into scraping_queue).
      await admin.enqueueScrape(id);
      toast({
        title: USE_MOCK_DATA ? "Queued for stat refresh" : "Stat refresh worker triggered",
        variant: "success",
      });
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Couldn't trigger the stat refresh",
        variant: "error",
      });
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title={t("nav.bloggers")}
        subtitle="Drag rows by the handle to set the ranking"
        action={
          saving ? (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </span>
          ) : undefined
        }
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("league.search")}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        {/* header */}
        <div className={cn(GRID, "border-b bg-secondary/50 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground")}>
          <span />
          <span className="text-center">#</span>
          <span>{t("league.blogger")}</span>
          <span>{t("league.category")}</span>
          <span>{t("league.followers")}</span>
          <span className="text-right">{t("common.actions")}</span>
        </div>

        {searching ? (
          <>
            <div className="bg-warning/40 px-4 py-2 text-xs text-warning-foreground">
              Clear search to drag-reorder the full list
            </div>
            {filtered.map((inf) => (
              <div key={inf.id} className={cn(GRID, "border-b py-3 text-sm last:border-0 opacity-90")}>
                <span />
                <span className="text-center font-bold tabular text-muted-foreground">
                  {inf.league_rank ?? "—"}
                </span>
                <div className="flex min-w-0 items-center gap-3">
                  <InfluencerAvatar name={inf.display_name} avatarUrl={inf.avatar_url} className="h-8 w-8" fallbackClassName="text-[11px]" />
                  <span className="truncate font-medium">{inf.display_name}</span>
                </div>
                <Badge variant="secondary" className="h-5 w-fit px-2 py-0 leading-none">
                  {t(`category.${inf.category}`)}
                </Badge>
                <span className="tabular">{formatNumber(inf.total_followers)}</span>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleVisible(inf.id, inf.is_visible)} aria-label="Toggle visibility">
                    {inf.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refresh(inf.id)} aria-label="Refresh stats">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </>
        ) : (
          <Reorder.Group axis="y" values={items} onReorder={setItems}>
            {items.map((inf, i) => (
              <BloggerRow
                key={inf.id}
                inf={inf}
                rank={i + 1}
                onToggleVisible={() => toggleVisible(inf.id, inf.is_visible)}
                onRefresh={() => refresh(inf.id)}
                onCommit={commit}
              />
            ))}
          </Reorder.Group>
        )}
      </div>
    </div>
  );
}
