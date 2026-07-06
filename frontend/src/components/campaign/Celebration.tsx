import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/motion";

// One short celebratory confetti burst (~1.5s). Self-contained — no external
// library. Skipped entirely under prefers-reduced-motion. Mount with a unique
// `fireKey` to trigger; it cleans itself up.
const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];
const PIECES = 42;

export function Celebration({ fireKey }: { fireKey: number }) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (fireKey === 0 || reduced) return;
    setActive(true);
    const timer = setTimeout(() => setActive(false), 1500);
    return () => clearTimeout(timer);
  }, [fireKey, reduced]);

  if (reduced) return null;

  return (
    <AnimatePresence>
      {active && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[100] overflow-hidden">
          {Array.from({ length: PIECES }).map((_, i) => {
            // Deterministic spread from the index so we don't need Math.random.
            const angle = (i / PIECES) * Math.PI * 2;
            const dist = 180 + (i % 5) * 60;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist - 120;
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/3 h-2.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                animate={{
                  opacity: [1, 1, 0],
                  x,
                  y: [0, y, y + 260],
                  rotate: (i % 2 ? 1 : -1) * (180 + i * 12),
                  scale: 0.8,
                }}
                transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
              />
            );
          })}
        </div>
      )}
    </AnimatePresence>
  );
}
