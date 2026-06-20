import { describe, it, expect } from "vitest";
import { PLANS } from "./plans";

describe("PLANS", () => {
  it("defines exactly the three billable plans", () => {
    expect(PLANS.map((p) => p.plan).sort()).toEqual([
      "brand_pro",
      "influencer_feature",
      "influencer_sync",
    ]);
  });

  it("targets each plan at the right audience", () => {
    const byPlan = Object.fromEntries(PLANS.map((p) => [p.plan, p.audience]));
    expect(byPlan.brand_pro).toBe("brand");
    expect(byPlan.influencer_sync).toBe("influencer");
    expect(byPlan.influencer_feature).toBe("influencer");
  });

  it("gives every plan a name, price and at least one feature", () => {
    for (const p of PLANS) {
      expect(p.name).toBeTruthy();
      expect(p.price).toMatch(/^\$\d+/);
      expect(p.features.length).toBeGreaterThan(0);
    }
  });
});
