import { useEffect, useState, useCallback } from "react";
import { notifications as api } from "@/lib/api";
import { useAuth } from "./useAuth";
import type { Notification } from "@/types";

export function useNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!user) return setItems([]);
    setItems(await api.forUser(user.id));
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    // Supabase Realtime when connected, mock event bus otherwise.
    const unsub = api.subscribeForUser(user.id, () => load());
    return unsub;
  }, [user, load]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  const markRead = useCallback(
    async (id: string) => {
      await api.markRead(id);
      load();
    },
    [load],
  );

  const markAllRead = useCallback(async () => {
    if (user) await api.markAllRead(user.id);
    load();
  }, [user, load]);

  return { items, unreadCount, markRead, markAllRead, refresh: load };
}
