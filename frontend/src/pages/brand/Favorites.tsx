import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { InfluencerCard } from "@/components/league/InfluencerCard";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { favorites, influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import type { InfluencerFull } from "@/types";

export default function Favorites() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [list, setList] = useState<InfluencerFull[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const ids = await favorites.forUser(user.id);
      const res = await Promise.all(ids.map((id) => influencers.get(id)));
      setList(res.filter(Boolean) as InfluencerFull[]);
      setLoading(false);
    })();
  }, [user]);

  return (
    <div>
      <PageHeader title={t("nav.favorites")} subtitle={t("dashboard.savedBloggers")} />
      {loading ? (
        <PageLoader />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No favorites yet"
          description="Save bloggers from the league to find them here."
          action={
            <Button asChild>
              <Link to="/brand/league">{t("league.title")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((inf) => (
            <InfluencerCard
              key={inf.id}
              influencer={inf}
              profileLink={`/brand/bloggers/${inf.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
