import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Eye, EyeOff, Search } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageLoader } from "@/components/common";
import { admin, influencers } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { formatNumber } from "@/lib/utils";
import type { InfluencerFull } from "@/types";

export default function AdminBloggers() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [data, setData] = useState<InfluencerFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((i) => i.display_name.toLowerCase().includes(q));
  }, [data, query]);

  const load = () =>
    influencers.listAll().then((d) => {
      setData(d.sort((a, b) => (a.league_rank ?? 999) - (b.league_rank ?? 999)));
      setLoading(false);
    });
  useEffect(() => {
    load();
  }, []);

  const setRank = async (id: string, rank: number) => {
    await admin.setInfluencerRank(id, rank);
    load();
  };
  const toggleVisible = async (id: string, current: boolean) => {
    await admin.setVisible(id, !current);
    load();
  };
  const refresh = (id: string) => {
    admin.enqueueScrape(id);
    toast({ title: "Queued for stat refresh", variant: "success" });
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title={t("nav.bloggers")} subtitle={`${data.length} total`} />
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("league.search")}
          className="pl-9"
        />
      </div>
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("league.rank")}</TableHead>
              <TableHead>{t("league.blogger")}</TableHead>
              <TableHead>{t("league.category")}</TableHead>
              <TableHead>{t("league.followers")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead className="text-right">{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((inf) => (
              <TableRow key={inf.id}>
                <TableCell className="w-20">
                  <Input
                    type="number"
                    defaultValue={inf.league_rank ?? 0}
                    className="h-8 w-16"
                    onBlur={(e) => setRank(inf.id, Number(e.target.value))}
                  />
                </TableCell>
                <TableCell className="font-medium">{inf.display_name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{t(`category.${inf.category}`)}</Badge>
                </TableCell>
                <TableCell>{formatNumber(inf.total_followers)}</TableCell>
                <TableCell>
                  <Badge variant={inf.is_visible ? "success" : "muted"}>
                    {inf.is_visible ? "Visible" : "Hidden"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleVisible(inf.id, inf.is_visible)}
                    >
                      {inf.is_visible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => refresh(inf.id)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
