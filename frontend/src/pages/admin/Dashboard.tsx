import { useEffect, useState } from "react";
import { Users, Trophy, Megaphone, DollarSign, Handshake } from "lucide-react";
import { StatCard, PageHeader } from "@/components/common";
import { admin } from "@/lib/api";
import { useLanguage } from "@/hooks/useLanguage";
import { formatUSD } from "@/lib/utils";

type Stats = Awaited<ReturnType<typeof admin.stats>>;
const EMPTY: Stats = { users: 0, influencers: 0, campaigns: 0, deals: 0, revenue: 0 };

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    admin.stats().then(setStats);
  }, []);

  return (
    <div>
      <PageHeader title={t("admin.dashboard")} subtitle={t("admin.platformOverview")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Users} label={t("admin.totalUsers")} value={stats.users} accent delay={0} />
        <StatCard
          icon={Trophy}
          label={t("admin.totalInfluencers")}
          value={stats.influencers}
          delay={0.1}
        />
        <StatCard
          icon={Megaphone}
          label={t("admin.totalCampaigns")}
          value={stats.campaigns}
          delay={0.2}
        />
        <StatCard icon={Handshake} label={t("nav.deals")} value={stats.deals} delay={0.3} />
        <StatCard
          icon={DollarSign}
          label={t("admin.totalRevenue")}
          value={formatUSD(stats.revenue)}
          delay={0.4}
        />
      </div>
    </div>
  );
}
