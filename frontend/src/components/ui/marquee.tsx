import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Marquee — infinite horizontal scroller. Adapted from a 21st.dev logo-cloud
 * pattern: a seamless double track (children rendered twice), pause-on-hover,
 * and an edge-fade mask. Token-driven, dependency-free, and reduced-motion
 * aware (the track sits still when the user prefers reduced motion).
 */
export function Marquee({
  children,
  speed = "40s",
  reverse = false,
  fadeWidth = 64,
  className,
}: {
  children: ReactNode;
  /** One full loop duration, e.g. "40s" (lower = faster). */
  speed?: string;
  reverse?: boolean;
  /** Width of the fade-out on each edge, in px. */
  fadeWidth?: number;
  className?: string;
}) {
  return (
    <div
      // Decorative: the duplicated track shouldn't be announced twice.
      aria-hidden="true"
      className={cn("group w-full overflow-hidden", className)}
      style={{
        maskImage: `linear-gradient(to right, transparent, #000 ${fadeWidth}px, #000 calc(100% - ${fadeWidth}px), transparent)`,
        WebkitMaskImage: `linear-gradient(to right, transparent, #000 ${fadeWidth}px, #000 calc(100% - ${fadeWidth}px), transparent)`,
      }}
    >
      <div
        className="flex w-max animate-marquee items-center gap-12 pr-12 group-hover:[animation-play-state:paused] motion-reduce:animate-none"
        style={{ animationDuration: speed, animationDirection: reverse ? "reverse" : "normal" }}
      >
        {children}
        {children}
      </div>
    </div>
  );
}
