import { useEffect, useState } from "react";
import { influencers } from "@/lib/api";
import type { InfluencerFull } from "@/types";

export function useInfluencers(opts: { all?: boolean } = {}) {
  const [data, setData] = useState<InfluencerFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    (opts.all ? influencers.listAll() : influencers.list())
      .then((d) => {
        if (mounted) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        // Never spin forever — surface the error and stop loading.
        if (mounted) {
          console.error(e);
          setError(String((e as Error)?.message ?? e));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [opts.all]);

  return { data, loading, error, setData };
}

export function useInfluencer(id: string | undefined) {
  const [data, setData] = useState<InfluencerFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    influencers
      .get(id)
      .then((d) => {
        if (mounted) {
          setData(d);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (mounted) {
          console.error(e);
          setError(String((e as Error)?.message ?? e));
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  return { data, loading, error };
}
