import { useEffect, useRef, useState, useCallback } from "react";
import { messages as api } from "@/lib/api";
import { uid } from "@/lib/utils";
import type { Message } from "@/types";

/** Message plus client-only delivery state for optimistic sends. */
export type ChatMessage = Message & { pending?: boolean };

const TYPING_TTL_MS = 3000;
const TYPING_THROTTLE_MS = 1500;

export function useMessages(dealId: string | undefined, selfUserId?: string) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingSent = useRef(0);

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
    const unsubTyping = api.subscribeTyping(dealId, ({ userId }) => {
      if (selfUserId && userId === selfUserId) return; // mock bus echoes to self
      setPeerTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setPeerTyping(false), TYPING_TTL_MS);
    });
    return () => {
      unsub();
      unsubTyping();
      clearTimeout(typingTimer.current);
    };
  }, [dealId, load, selfUserId]);

  // Optimistic send: the bubble shows up immediately as "sending", then flips
  // to "delivered" once the server row replaces it (or the realtime echo wins).
  const send = useCallback(
    async (senderId: string, content: string) => {
      const text = content.trim();
      if (!dealId || !text) return;
      const temp: ChatMessage = {
        id: `temp-${uid()}`,
        deal_id: dealId,
        sender_id: senderId,
        content: text,
        created_at: new Date().toISOString(),
        pending: true,
      };
      setItems((prev) => [...prev, temp]);
      try {
        const real = await api.send(dealId, senderId, text);
        setItems((prev) => {
          const withoutTemp = prev.filter((m) => m.id !== temp.id);
          return withoutTemp.some((m) => m.id === real.id) ? withoutTemp : [...withoutTemp, real];
        });
      } catch (err) {
        setItems((prev) => prev.filter((m) => m.id !== temp.id));
        throw err;
      }
    },
    [dealId],
  );

  /** Call on every input change; broadcasts are throttled internally. */
  const notifyTyping = useCallback(
    (userId: string) => {
      if (!dealId) return;
      const now = Date.now();
      if (now - lastTypingSent.current < TYPING_THROTTLE_MS) return;
      lastTypingSent.current = now;
      void api.sendTyping(dealId, userId);
    },
    [dealId],
  );

  return { items, loading, send, peerTyping, notifyTyping };
}
