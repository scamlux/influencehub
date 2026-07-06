import { Check, Clock3 } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { transition } from "@/lib/motion";

export function MessageBubble({
  content,
  mine,
  time,
  pending,
}: {
  content: string;
  mine: boolean;
  time: string;
  pending?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transition.fast}
      className={cn("flex", mine ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm",
          mine
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-secondary text-foreground",
          pending && "opacity-70",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-[10px]",
            mine ? "justify-end text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {time}
          {mine &&
            (pending ? <Clock3 className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />)}
        </p>
      </div>
    </motion.div>
  );
}

/** Animated "peer is typing" placeholder bubble. */
export function TypingBubble({ label }: { label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={transition.fast}
      className="flex justify-start"
    >
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm bg-secondary px-4 py-2.5"
        aria-label={label}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </motion.div>
  );
}
