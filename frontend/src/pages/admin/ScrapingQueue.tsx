import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";
import { ScrapingQueueTable } from "@/components/admin/ScrapingQueueTable";
import { admin, subscribe, influencers } from "@/lib/api";
import { mockDB } from "@/lib/mock-data";
import { useLanguage } from "@/hooks/useLanguage";
import type { ScrapingQueueItem } from "@/types";

export default function AdminScrapingQueue() {
  const { t } = useLanguage();
  const [items, setItems] = useState<ScrapingQueueItem[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    admin.scrapingQueue().then(setItems);
    influencers
      .listAll()
      .then((list) => setNames(Object.fromEntries(list.map((i) => [i.id, i.display_name]))));
    // realtime channel: scraping-queue-admin (mock bus; under Supabase, refresh manually)
    const unsub = subscribe("scraping-queue-admin", () => {
      admin.scrapingQueue().then(setItems);
    });
    return unsub;
  }, []);

  const nameFor = (id: string) => names[id] ?? "—";

  const requeue = () => {
    const random =
      mockDB.influencer_profiles[Math.floor(Math.random() * mockDB.influencer_profiles.length)];
    admin.enqueueScrape(random.id);
  };

  return (
    <div>
      <PageHeader
        title={t("nav.scrapingQueue")}
        subtitle="Live via channel scraping-queue-admin"
        action={
          <Button onClick={requeue}>
            <RefreshCw className="h-4 w-4" /> Queue a job
          </Button>
        }
      />
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <ScrapingQueueTable items={items} nameFor={nameFor} />
      </div>
    </div>
  );
}
