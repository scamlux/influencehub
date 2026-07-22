import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetMockDB, mockDB } from "./mock-data";
import { bids, campaigns, subscriptions, favorites, deals, admin } from "./api";
import { splitEscrow } from "./plans";
import { uid } from "./utils";
import type { Subscription } from "@/types";

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

const makeSub = (over: Partial<Subscription>): Subscription => ({
  id: uid(),
  user_id: uid(),
  plan_type: "brand_pro",
  status: "active",
  expires_at: null,
  stripe_subscription_id: null,
  created_at: new Date().toISOString(),
  ...over,
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

  it("ignores cancelled and expired subscriptions", async () => {
    const userId = uid();
    mockDB.subscriptions.push(
      makeSub({ user_id: userId, status: "cancelled" }),
      makeSub({
        user_id: userId,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    );
    expect(await subscriptions.activeFor(userId)).toBeNull();
  });
});

describe("subscriptions.forUser", () => {
  it("returns only the user's subscriptions, newest first", async () => {
    const userId = uid();
    mockDB.subscriptions.push(
      makeSub({ user_id: userId, created_at: "2024-01-01T00:00:00.000Z", status: "cancelled" }),
      makeSub({ user_id: userId, created_at: "2025-06-01T00:00:00.000Z" }),
      makeSub({ user_id: uid(), created_at: "2025-07-01T00:00:00.000Z" }),
    );
    const list = await subscriptions.forUser(userId);
    expect(list).toHaveLength(2);
    expect(list.every((s) => s.user_id === userId)).toBe(true);
    expect(list.map((s) => s.created_at)).toEqual([
      "2025-06-01T00:00:00.000Z",
      "2024-01-01T00:00:00.000Z",
    ]);
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

describe("admin scraping queue (mock)", () => {
  it("enqueueScrape queues a pending item and simulates pending → processing → completed", async () => {
    vi.useFakeTimers();
    try {
      const infId = mockDB.influencer_profiles[0].id;
      const item = await admin.enqueueScrape(infId);
      expect(item).not.toBeNull();
      expect(item?.status).toBe("pending");
      expect(item?.influencer_id).toBe(infId);

      const queued = (await admin.scrapingQueue()).find((q) => q.id === item?.id);
      expect(queued?.status).toBe("pending");

      await vi.advanceTimersByTimeAsync(1200);
      expect(item?.status).toBe("processing");
      await vi.advanceTimersByTimeAsync(1500);
      expect(item?.status).toBe("completed");
      expect((await admin.scrapingQueue()).find((q) => q.id === item?.id)?.status).toBe(
        "completed",
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("subscribeScrapingQueue notifies on enqueue and cleanup unsubscribes", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const unsub = admin.subscribeScrapingQueue(() => calls++);
      await admin.enqueueScrape(mockDB.influencer_profiles[0].id);
      expect(calls).toBe(1);

      unsub();
      // The simulated processing keeps emitting after cleanup — we must not hear it.
      await vi.advanceTimersByTimeAsync(3000);
      expect(calls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("admin.reset", () => {
  it("restores the seeded state after mutations", async () => {
    const seededSubs = mockDB.subscriptions.length;
    const seededQueue = mockDB.scraping_queue.length;
    const userId = mockDB.brand_profiles[0].user_id;

    await subscriptions.checkout(userId, "brand_pro");
    mockDB.scraping_queue.push({
      id: uid(),
      influencer_id: mockDB.influencer_profiles[0].id,
      status: "pending",
      error: null,
      created_at: new Date().toISOString(),
    });
    expect(mockDB.subscriptions.length).toBe(seededSubs + 1);

    await admin.reset();
    expect(mockDB.subscriptions.length).toBe(seededSubs);
    expect(mockDB.scraping_queue.length).toBe(seededQueue);
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
