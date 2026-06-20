import { useEffect, useState, useCallback } from "react";
import { subscriptions } from "@/lib/api";
import { useAuth } from "./useAuth";
import type { PlanType, Subscription } from "@/types";

export function useSubscription() {
  const { user } = useAuth();
  const [active, setActive] = useState<Subscription | null>(null);
  const [all, setAll] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setActive(null);
      setAll([]);
      setLoading(false);
      return;
    }
    const [a, list] = await Promise.all([
      subscriptions.activeFor(user.id),
      subscriptions.forUser(user.id),
    ]);
    setActive(a);
    setAll(list);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const checkout = useCallback(
    async (plan: PlanType, provider: "stripe" | "payme" = "stripe") => {
      if (!user) throw new Error("Not authenticated");
      const res = await subscriptions.checkout(user.id, plan, provider);
      await load();
      return res;
    },
    [user, load],
  );

  const isBrandPro = active?.plan_type === "brand_pro" && active?.status === "active";

  return { active, all, loading, isBrandPro, checkout, refresh: load };
}
