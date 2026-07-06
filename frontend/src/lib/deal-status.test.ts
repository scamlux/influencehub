import { describe, it, expect } from "vitest";
import {
  allowedActions,
  canonicalStep,
  canTransition,
  DEAL_STEPS,
  isTerminal,
  nextStatus,
  stepIndex,
} from "./deal-status";

describe("deal-status machine", () => {
  it("walks the happy escrow path pending → released", () => {
    expect(nextStatus("pending", "fund")).toBe("funded");
    expect(nextStatus("funded", "start")).toBe("in_progress");
    expect(nextStatus("in_progress", "deliver")).toBe("delivered");
    expect(nextStatus("delivered", "release")).toBe("released");
  });

  it("enforces role permissions on transitions", () => {
    expect(canTransition("pending", "fund", "brand")).toBe(true);
    expect(canTransition("pending", "fund", "influencer")).toBe(false);
    expect(canTransition("funded", "start", "influencer")).toBe(true);
    expect(canTransition("funded", "start", "brand")).toBe(false);
    expect(canTransition("delivered", "release", "brand")).toBe(true);
    expect(canTransition("delivered", "release", "influencer")).toBe(false);
  });

  it("rejects illegal transitions", () => {
    expect(nextStatus("pending", "release")).toBeNull();
    expect(nextStatus("released", "dispute")).toBeNull();
    expect(canTransition("pending", "deliver", "influencer")).toBe(false);
  });

  it("allows either party to dispute an in-flight deal", () => {
    for (const from of ["funded", "in_progress", "delivered"] as const) {
      expect(canTransition(from, "dispute", "brand")).toBe(true);
      expect(canTransition(from, "dispute", "influencer")).toBe(true);
      expect(nextStatus(from, "dispute")).toBe("disputed");
    }
  });

  it("lets only admins resolve disputes", () => {
    expect(canTransition("disputed", "resolve_release", "admin")).toBe(true);
    expect(canTransition("disputed", "resolve_refund", "admin")).toBe(true);
    expect(canTransition("disputed", "resolve_release", "brand")).toBe(false);
    expect(nextStatus("disputed", "resolve_release")).toBe("released");
    expect(nextStatus("disputed", "resolve_refund")).toBe("cancelled");
  });

  it("lets a legacy active deal be funded", () => {
    expect(canTransition("active", "fund", "brand")).toBe(true);
    expect(nextStatus("active", "fund")).toBe("funded");
  });

  it("maps legacy statuses onto canonical steps", () => {
    expect(canonicalStep("content_submitted")).toBe("delivered");
    expect(canonicalStep("approved")).toBe("released");
    expect(canonicalStep("completed")).toBe("released");
    expect(canonicalStep("active")).toBe("funded");
    expect(canonicalStep("disputed")).toBeNull();
    expect(canonicalStep("cancelled")).toBeNull();
  });

  it("computes a monotonic step index along the lifecycle", () => {
    expect(stepIndex("pending")).toBe(0);
    expect(stepIndex("funded")).toBe(1);
    expect(stepIndex("released")).toBe(DEAL_STEPS.length - 1);
    expect(stepIndex("disputed")).toBe(-1);
  });

  it("exposes role-scoped available actions", () => {
    expect(allowedActions("funded", "influencer")).toEqual(
      expect.arrayContaining(["start", "dispute"]),
    );
    expect(allowedActions("funded", "influencer")).not.toContain("fund");
    expect(allowedActions("delivered", "brand")).toEqual(
      expect.arrayContaining(["release", "dispute"]),
    );
    expect(allowedActions("released", "brand")).toEqual([]);
  });

  it("flags terminal statuses", () => {
    expect(isTerminal("released")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("funded")).toBe(false);
  });
});
