import { describe, it, expect, beforeEach } from "vitest";
import { resetMockDB, mockDB } from "./mock-data";
import { bids, campaigns, subscriptions, favorites } from "./api";
import { uid } from "./utils";

beforeEach(() => {
  resetMockDB();
});

describe("bids.accept (mock data layer)", () => {
  it("accepts the winning bid, rejects the rest, activates the campaign and creates a deal", async () => {
    const brand = mockDB.brand_profiles[0];
    const [infA, infB] = mockDB.influencer_profiles;

    const campaign = await campaigns.create({
      brand_id: brand.id,
      title: "Test campaign",
      description: "desc",
      requirements: null,
      budget_usd: 500,
      platform: "instagram",
      category: "lifestyle",
      status: "open",
      deadline: null,
    });

    const winning = await bids.create({
      campaign_id: campaign.id,
      influencer_id: infA.id,
      proposed_price: 400,
      proposal: "pick me",
      delivery_days: 7,
    });
    await bids.create({
      campaign_id: campaign.id,
      influencer_id: infB.id,
      proposed_price: 450,
      proposal: "no, me",
      delivery_days: 5,
    });

    const deal = await bids.accept(winning.id);

    expect(deal.campaign_id).toBe(campaign.id);
    expect(deal.influencer_id).toBe(infA.id);
    expect(deal.agreed_price).toBe(400);
    expect(deal.status).toBe("active");

    const allBids = await bids.forCampaign(campaign.id);
    const accepted = allBids.filter((b) => b.status === "accepted");
    const rejected = allBids.filter((b) => b.status === "rejected");
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const updated = await campaigns.get(campaign.id);
    expect(updated?.status).toBe("active");
  });

  it("throws on an unknown bid id", async () => {
    await expect(bids.accept(uid())).rejects.toThrow();
  });
});

describe("subscriptions.activeFor", () => {
  it("returns null when the user has no subscription", async () => {
    expect(await subscriptions.activeFor(uid())).toBeNull();
  });

  it("returns an active subscription after checkout", async () => {
    const userId = mockDB.brand_profiles[0].user_id;
    await subscriptions.checkout(userId, "brand_pro");
    const active = await subscriptions.activeFor(userId);
    expect(active?.plan_type).toBe("brand_pro");
    expect(active?.status).toBe("active");
  });
});

describe("favorites.toggle", () => {
  it("adds then removes a favorite", async () => {
    // A fresh user id so the assertion is independent of any seeded favorites.
    const userId = uid();
    const infId = mockDB.influencer_profiles[0].id;

    expect(await favorites.toggle(userId, infId)).toBe(true);
    expect(await favorites.forUser(userId)).toContain(infId);

    expect(await favorites.toggle(userId, infId)).toBe(false);
    expect(await favorites.forUser(userId)).not.toContain(infId);
  });
});
