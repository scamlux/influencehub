import { motion } from "motion/react";
import {
  Check,
  CircleDollarSign,
  Hammer,
  PackageCheck,
  PartyPopper,
  AlertTriangle,
} from "lucide-react";
import { DEAL_STEPS, stepIndex, isDisputed, isCancelled } from "@/lib/deal-status";
import { transition } from "@/lib/motion";
import { useLanguage } from "@/hooks/useLanguage";
import type { DealStatus } from "@/types";

const STEP_ICON = [CircleDollarSign, CircleDollarSign, Hammer, PackageCheck, PartyPopper];
const STEP_LABEL_KEY = [
  "deal.step.pending",
  "deal.step.funded",
  "deal.step.inProgress",
  "deal.step.delivered",
  "deal.step.released",
] as const;

/**
 * Horizontal escrow progress stepper — the visual centerpiece of the deal
 * page. Animated fill runs between completed nodes; `disputed` swaps to a red
 * branch. Respects reduced motion (Framer neutralises the transforms).
 */
export function DealStepper({ status }: { status: DealStatus }) {
  const { t } = useLanguage();
  const active = stepIndex(status); // -1 for disputed/cancelled
  const disputed = isDisputed(status);
  const cancelled = isCancelled(status);

  if (disputed || cancelled) {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border p-4 ${
          disputed
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : "border-muted bg-muted/30 text-muted-foreground"
        }`}
      >
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">
            {disputed ? t("deal.disputed.title") : t("deal.cancelled.title")}
          </p>
          <p className="text-xs opacity-80">
            {disputed ? t("deal.disputed.desc") : t("deal.cancelled.desc")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <ol className="flex items-center">
        {DEAL_STEPS.map((step, i) => {
          const Icon = STEP_ICON[i];
          const done = i < active;
          const current = i === active;
          const reached = i <= active;
          return (
            <li key={step} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-2">
                <motion.div
                  initial={false}
                  animate={{
                    scale: current ? 1.1 : 1,
                    backgroundColor: reached ? "var(--primary)" : "var(--muted)",
                    color: reached ? "var(--primary-foreground)" : "var(--muted-foreground)",
                  }}
                  transition={transition.spring}
                  className="flex h-10 w-10 items-center justify-center rounded-full ring-4 ring-background"
                >
                  {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </motion.div>
                <span
                  className={`whitespace-nowrap text-[11px] font-medium ${
                    reached ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {t(STEP_LABEL_KEY[i])}
                </span>
              </div>
              {i < DEAL_STEPS.length - 1 && (
                <div className="mx-2 mb-6 h-0.5 flex-1 overflow-hidden rounded bg-muted">
                  <motion.div
                    className="h-full bg-primary"
                    initial={false}
                    animate={{ scaleX: i < active ? 1 : 0 }}
                    style={{ originX: 0 }}
                    transition={{ ...transition.base, delay: i < active ? 0.05 * i : 0 }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
