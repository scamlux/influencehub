import { useEffect, useRef, useState } from "react";
import { Send, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble, TypingBubble } from "./MessageBubble";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { PageLoader } from "@/components/common";
import { deals, campaigns, influencers, notifications } from "@/lib/api";

/** Keep auto-scrolling while the user is within this distance of the bottom. */
const NEAR_BOTTOM_PX = 80;

export function ChatWindow({ dealId, backTo }: { dealId: string; backTo: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const { items, loading, send, peerTyping, notifyTyping } = useMessages(dealId, user?.id);
  const [text, setText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);

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

  // Opening the chat clears its unread notification badge; new incoming
  // messages while the chat is open are cleared as well.
  useEffect(() => {
    if (!user) return;
    void notifications.markReadByLink(user.id, location.pathname);
  }, [user, location.pathname, items.length]);

  // Autoscroll only when the reader is already at the bottom or just sent a
  // message — never yank the view away from scrolled-back history.
  useEffect(() => {
    const last = items[items.length - 1];
    const mineJustSent = last && last.sender_id === user?.id;
    if (nearBottom.current || mineJustSent) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [items, peerTyping, user?.id]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !text.trim()) return;
    const value = text;
    setText("");
    try {
      await send(user.id, value);
    } catch {
      setText(value); // restore the draft so nothing is lost
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col rounded-xl border bg-card">
      <div className="flex items-center gap-3 border-b p-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to={backTo}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">{t("chat.title")}</h1>
          {subtitle ? (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ) : (
            <p className="truncate text-xs text-muted-foreground">
              {t("chat.deal")} #{dealId.slice(0, 8)}
            </p>
          )}
        </div>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted-foreground">{t("chat.noMessages")}</p>
        ) : (
          items.map((m) => (
            <MessageBubble
              key={m.id}
              content={m.content}
              mine={m.sender_id === user?.id}
              pending={m.pending}
              time={new Date(m.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          ))
        )}
        <AnimatePresence>{peerTyping && <TypingBubble label={t("chat.typing")} />}</AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 border-t p-3">
        <Input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (user && e.target.value) notifyTyping(user.id);
          }}
          placeholder={t("chat.placeholder")}
        />
        <Button type="submit" size="icon" className="active:scale-[0.98]" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
