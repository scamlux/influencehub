import { useEffect, useState, useCallback } from "react";
import { deals } from "@/lib/api";
import type { Deal } from "@/types";

export function useDeals(role: "brand" | "influencer", profileId: string | undefined) {
  const [data, setData] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!profileId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (role === "brand" ? deals.forBrand(profileId) : deals.forInfluencer(profileId)).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [role, profileId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, refresh: load };
}
