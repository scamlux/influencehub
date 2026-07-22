import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";
import { ScrapingQueueTable } from "@/components/admin/ScrapingQueueTable";
import { admin, influencers } from "@/lib/api";
import { USE_MOCK_DATA } from "@/lib/supabase";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import type { ScrapingQueueItem } from "@/types";

export default function AdminScrapingQueue() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [items, setItems] = useState<ScrapingQueueItem[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    admin.scrapingQueue().then(setItems);
    influencers
      .listAll()
      .then((list) => setNames(Object.fromEntries(list.map((i) => [i.id, i.display_name]))));
    // mock: in-memory event bus; live: 10s polling (scraping_queue has no realtime publication)
    return admin.subscribeScrapingQueue(() => {
      admin.scrapingQueue().then(setItems);
    });
  }, []);

  const nameFor = (id: string) => names[id] ?? "—";

  const processQueue = async () => {
    const ids = Object.keys(names);
    if (USE_MOCK_DATA && !ids.length) return;
    setBusy(true);
    try {
      // Mock: enqueue a random influencer. Live: the id is ignored — the call
      // triggers the process-scraping-queue worker over already-pending rows.
      await admin.enqueueScrape(ids[Math.floor(Math.random() * ids.length)]);
      toast({
        title: USE_MOCK_DATA ? "Job queued" : "Queue processing triggered",
        variant: "success",
      });
      if (!USE_MOCK_DATA) admin.scrapingQueue().then(setItems);
    } catch (e) {
      toast({
        title: e instanceof Error ? e.message : "Couldn't process the queue",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("nav.scrapingQueue")}
        subtitle={
          USE_MOCK_DATA ? "Live via channel scraping-queue-admin" : "Auto-refreshes every 10s"
        }
        action={
          <Button onClick={processQueue} disabled={busy}>
            <RefreshCw className="h-4 w-4" /> {USE_MOCK_DATA ? "Queue a job" : "Process queue"}
          </Button>
        }
      />
      <div className="rounded-xl border bg-card dark:bg-card dark:border dark:border-border">
        <ScrapingQueueTable items={items} nameFor={nameFor} />
      </div>
    </div>
  );
}
