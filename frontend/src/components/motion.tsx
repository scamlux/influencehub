import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";
import {
  ease,
  fadeInUp,
  pageTransition,
  staggerContainer,
  staggerItem,
} from "@/lib/motion";

/**
 * Reveal — scroll-triggered entrance. Animates once when scrolled into view.
 * Defaults to fadeInUp; pass any variant. Reduced motion shows content instantly.
 */
export function Reveal({
  children,
  variants = fadeInUp,
  className,
  delay = 0,
}: {
  children: ReactNode;
  variants?: Variants;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={delay ? { delay } : undefined}
    >
      {children}
    </motion.div>
  );
}

/** Stagger — container that reveals its <StaggerItem> children in sequence. */
export function Stagger({
  children,
  className,
  inView = true,
}: {
  children: ReactNode;
  className?: string;
  /** When false, plays on mount instead of on scroll-into-view. */
  inView?: boolean;
}) {
  const viewProps = inView
    ? ({ whileInView: "show", viewport: { once: true, margin: "-8% 0px" } } as const)
    : ({ animate: "show" } as const);
  return (
    <motion.div className={className} variants={staggerContainer} initial="hidden" {...viewProps}>
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerItem}>
      {children}
    </motion.div>
  );
}

/** PageTransition — wraps a route's content for a subtle enter on navigation. */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={pageTransition} initial="hidden" animate="show">
      {children}
    </motion.div>
  );
}

/**
 * AnimatedCounter — counts up to `value` when scrolled into view.
 * Respects reduced motion (renders final value immediately) and uses tabular
 * figures so the layout never shifts mid-count.
 */
export function AnimatedCounter({
  value,
  duration = 1.1,
  format,
  className,
}: {
  value: number;
  duration?: number;
  format?: (n: number) => string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: ease.out,
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, reduced, duration]);

  const text = format ? format(display) : Math.round(display).toLocaleString();
  return (
    <span ref={ref} className={cn("tabular", className)}>
      {text}
    </span>
  );
}

/** AnimatedBar — width-grows a progress bar into view (animates transform-safe scaleX). */
export function AnimatedBar({
  value,
  className,
  barClassName,
}: {
  /** 0–100 */
  value: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-secondary", className)}>
      <motion.div
        className={cn("h-full origin-left rounded-full bg-primary", barClassName)}
        style={{ width: `${pct}%` }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8, ease: ease.out }}
      />
    </div>
  );
}

// Convenience re-export so screens can `import { motion } from "@/components/motion"`.
export { motion } from "motion/react";
