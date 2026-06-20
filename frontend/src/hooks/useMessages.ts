import { useEffect, useState, useCallback } from "react";
import { messages as api } from "@/lib/api";
import type { Message } from "@/types";

export function useMessages(dealId: string | undefined) {
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!dealId) return;
    api.forDeal(dealId).then((m) => {
      setItems(m);
      setLoading(false);
    });
  }, [dealId]);

  useEffect(() => {
    if (!dealId) return;
    load();
    // Supabase Realtime when connected, mock event bus otherwise.
    const unsub = api.subscribeToDeal(dealId, (msg: Message) => {
      setItems((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
    });
    return unsub;
  }, [dealId, load]);

  const send = useCallback(
    async (senderId: string, content: string) => {
      if (!dealId || !content.trim()) return;
      await api.send(dealId, senderId, content.trim());
      load();
    },
    [dealId, load],
  );

  return { items, loading, send };
}
