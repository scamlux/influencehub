import { useEffect, useState, useCallback } from "react";
import { campaigns } from "@/lib/api";
import type { Campaign } from "@/types";

export function useCampaigns(scope: "all" | "open" = "all") {
  const [data, setData] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    (scope === "open" ? campaigns.open() : campaigns.list()).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, refresh: load };
}
