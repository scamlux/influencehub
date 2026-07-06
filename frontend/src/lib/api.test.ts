import { describe, it, expect, beforeEach } from "vitest";
import { resetMockDB, mockDB } from "./mock-data";
import { bids, campaigns, subscriptions, favorites, deals, admin } from "./api";
import { splitEscrow } from "./plans";
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
    expect(deal.status).toBe("pending");

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

describe("deals escrow flow (mock data layer)", () => {
  async function makePendingDeal(price = 500) {
    const brand = mockDB.brand_profiles[0];
    const inf = mockDB.influencer_profiles[0];
    const campaign = await campaigns.create({
      brand_id: brand.id,
      title: "Escrow campaign",
      description: "desc",
      requirements: null,
      budget_usd: price,
      platform: "instagram",
      category: "lifestyle",
      status: "open",
      deadline: null,
    });
    const bid = await bids.create({
      campaign_id: campaign.id,
      influencer_id: inf.id,
      proposed_price: price,
      proposal: "hi",
      delivery_days: 5,
    });
    const deal = await bids.accept(bid.id);
    return { deal, brand, inf };
  }

  it("funds → releases with a 12% platform fee and enqueues a payout", async () => {
    const { deal, inf } = await makePendingDeal(500);
    expect(deal.status).toBe("pending");

    await deals.fund(deal.id);
    const payment = await deals.paymentFor(deal.id);
    const { feeCents, payoutCents } = splitEscrow(50000);
    expect(feeCents).toBe(6000); // 12% of $500
    expect(payoutCents).toBe(44000);
    expect(payment?.status).toBe("held");
    expect(payment?.fee_cents).toBe(feeCents);
    expect(payment?.payout_cents).toBe(payoutCents);
    expect((await deals.get(deal.id))?.status).toBe("funded");

    await deals.advance(deal.id, "start", "influencer");
    expect((await deals.get(deal.id))?.status).toBe("in_progress");
    await deals.advance(deal.id, "deliver", "influencer", { contentUrl: "https://x/y" });
    expect((await deals.get(deal.id))?.status).toBe("delivered");

    await deals.advance(deal.id, "release", "brand");
    expect((await deals.get(deal.id))?.status).toBe("released");
    expect((await deals.paymentFor(deal.id))?.status).toBe("released");

    const payouts = await admin.payouts();
    const payout = payouts.find((p) => p.deal_id === deal.id);
    expect(payout).toBeTruthy();
    expect(payout?.amount_cents).toBe(payoutCents);
    expect(payout?.influencer_id).toBe(inf.id);
    expect(payout?.status).toBe("pending");

    await admin.markPayoutPaid(payout!.id, mockDB.profiles[0].id);
    const settled = (await admin.payouts()).find((p) => p.id === payout!.id);
    expect(settled?.status).toBe("paid");
    expect((await deals.paymentFor(deal.id))?.status).toBe("paid_out");
  });

  it("refuses illegal transitions and wrong-role actions", async () => {
    const { deal } = await makePendingDeal(300);
    await expect(deals.advance(deal.id, "release", "brand")).rejects.toThrow();
    await deals.fund(deal.id);
    // influencer cannot release; brand cannot start
    await expect(deals.advance(deal.id, "release", "brand")).rejects.toThrow();
    await expect(deals.advance(deal.id, "start", "brand")).rejects.toThrow();
  });

  it("admin refund on a disputed deal returns money and cancels the deal", async () => {
    const { deal } = await makePendingDeal(400);
    await deals.fund(deal.id);
    await deals.advance(deal.id, "dispute", "brand");
    expect((await deals.get(deal.id))?.status).toBe("disputed");
    await deals.advance(deal.id, "resolve_refund", "admin");
    expect((await deals.get(deal.id))?.status).toBe("cancelled");
    expect((await deals.paymentFor(deal.id))?.status).toBe("refunded");
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
