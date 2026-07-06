// Deal escrow status machine (T-13).
//
// Pure and side-effect free so the whole transition table is unit-testable
// (deal-status.test.ts). The api layer calls `canTransition` before mutating
// and the UI calls `allowedActions` / `canonicalStep` to render controls and
// the stepper. Money never moves here — only status.

import type { DealStatus, UserRole } from "@/types";

// The escrow lifecycle shown in the stepper, in order.
export const DEAL_STEPS = [
  "pending",
  "funded",
  "in_progress",
  "delivered",
  "released",
] as const;
export type DealStep = (typeof DEAL_STEPS)[number];

// Legacy statuses map onto a canonical step so old rows still render on the
// stepper. `disputed` and `cancelled` are terminal/side branches (no step).
const LEGACY_STEP: Record<string, DealStep> = {
  active: "funded", // an accepted+live deal ≈ funded/in progress
  content_submitted: "delivered",
  approved: "released",
  completed: "released",
};

export function canonicalStep(status: DealStatus): DealStep | null {
  if ((DEAL_STEPS as readonly string[]).includes(status)) return status as DealStep;
  return LEGACY_STEP[status] ?? null;
}

export function stepIndex(status: DealStatus): number {
  const step = canonicalStep(status);
  return step ? DEAL_STEPS.indexOf(step) : -1;
}

export const isDisputed = (s: DealStatus) => s === "disputed";
export const isCancelled = (s: DealStatus) => s === "cancelled";
export const isTerminal = (s: DealStatus) =>
  s === "released" || s === "completed" || s === "approved" || s === "cancelled";

// Actions a user can take, and who may take them.
export type DealAction =
  | "fund" // brand pays into escrow
  | "start" // influencer begins work
  | "deliver" // influencer submits deliverable
  | "release" // brand approves → money released
  | "dispute" // either party opens a dispute
  | "resolve_release" // admin resolves dispute in influencer's favour
  | "resolve_refund"; // admin resolves dispute in brand's favour

interface Transition {
  from: DealStatus;
  action: DealAction;
  to: DealStatus;
  roles: UserRole[]; // who may perform it
}

// Legacy `active` deals can still be funded (they predate the pending state).
const TRANSITIONS: Transition[] = [
  { from: "pending", action: "fund", to: "funded", roles: ["brand"] },
  { from: "active", action: "fund", to: "funded", roles: ["brand"] },
  { from: "funded", action: "start", to: "in_progress", roles: ["influencer"] },
  { from: "in_progress", action: "deliver", to: "delivered", roles: ["influencer"] },
  { from: "delivered", action: "release", to: "released", roles: ["brand"] },
  { from: "funded", action: "dispute", to: "disputed", roles: ["brand", "influencer"] },
  { from: "in_progress", action: "dispute", to: "disputed", roles: ["brand", "influencer"] },
  { from: "delivered", action: "dispute", to: "disputed", roles: ["brand", "influencer"] },
  { from: "disputed", action: "resolve_release", to: "released", roles: ["admin"] },
  { from: "disputed", action: "resolve_refund", to: "cancelled", roles: ["admin"] },
];

export function nextStatus(from: DealStatus, action: DealAction): DealStatus | null {
  return TRANSITIONS.find((t) => t.from === from && t.action === action)?.to ?? null;
}

export function canTransition(from: DealStatus, action: DealAction, role: UserRole): boolean {
  return TRANSITIONS.some(
    (t) => t.from === from && t.action === action && t.roles.includes(role),
  );
}

/** Actions available to `role` from the current status (for rendering controls). */
export function allowedActions(status: DealStatus, role: UserRole): DealAction[] {
  return TRANSITIONS.filter((t) => t.from === status && t.roles.includes(role)).map(
    (t) => t.action,
  );
}
