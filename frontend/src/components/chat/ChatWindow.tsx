import { useEffect, useRef, useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "./MessageBubble";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { PageLoader } from "@/components/common";
import { deals, campaigns, influencers } from "@/lib/api";

export function ChatWindow({ dealId, backTo }: { dealId: string; backTo: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { items, loading, send } = useMessages(dealId);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Resolve a human-readable subtitle ("Blogger · Campaign") instead of a UUID.
  useEffect(() => {
    let active = true;
    (async () => {
      const deal = await deals.get(dealId);
      if (!deal) return;
      const [inf, camp] = await Promise.all([
        influencers.get(deal.influencer_id),
        campaigns.get(deal.campaign_id),
      ]);
      const parts = [inf?.display_name, camp?.title].filter(Boolean);
      if (active && parts.length) setSubtitle(parts.join(" · "));
    })();
    return () => {
      active = false;
    };
  }, [dealId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const value = text;
    setText("");
    await send(user.id, value);
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button asChild variant="ghost" size="icon">
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <p className="font-semibold">{subtitle || t("chat.title")}</p>
          <p className="text-xs text-muted-foreground">
            {subtitle ? t("chat.title") : `Deal #${dealId.slice(0, 8)}`}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">{t("chat.noMessages")}</p>
        ) : (
          items.map((m) => (
            <MessageBubble
              key={m.id}
              content={m.content}
              mine={m.sender_id === user?.id}
              time={new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
        />
        <Button type="submit" size="icon" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
