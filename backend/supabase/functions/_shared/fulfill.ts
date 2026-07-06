// Order fulfillment shared by all UZ payment providers (Payme, Click).
//
// An "order" is either a subscription purchase or escrow funding for a deal.
// Providers verify their own protocol/signature, then delegate the business
// effect here so activation, escrow math and refunds behave identically no
// matter which gateway the money came through.

import { PLANS_USD, planExpiry, splitEscrow, usdToTiyin, type PlanType } from "./uz.ts";

// deno-lint-ignore no-explicit-any
type Admin = any; // Supabase service-role client (structural use only)

export type OrderRef =
  | { kind: "deal"; dealId: string }
  | { kind: "subscription"; userId: string; plan: PlanType };

export type OrderValidation =
  | { ok: true; expectedTiyin: number }
  | { ok: false; reason: "not_found" | "not_fundable" };

export type ProviderMeta = { provider: string; providerRef: string; amountTiyin: number };

/** Parse "deal:<id>" / "sub:<user_id>:<plan>" merchant references (Click). */
export function parseOrderRef(merchantTransId: string): OrderRef | null {
  const parts = merchantTransId.split(":");
  if (parts[0] === "deal" && parts[1]) return { kind: "deal", dealId: parts[1] };
  if (parts[0] === "sub" && parts[1] && parts[2] && parts[2] in PLANS_USD) {
    return { kind: "subscription", userId: parts[1], plan: parts[2] as PlanType };
  }
  return null;
}

export async function validateOrder(admin: Admin, order: OrderRef): Promise<OrderValidation> {
  if (order.kind === "deal") {
    const { data: deal, error } = await admin
      .from("deals")
      .select("id, status, agreed_price")
      .eq("id", order.dealId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal) return { ok: false, reason: "not_found" };
    if (deal.status !== "pending") return { ok: false, reason: "not_fundable" };
    return { ok: true, expectedTiyin: usdToTiyin(Number(deal.agreed_price)) };
  }

  const { data: profile, error } = await admin
    .from("profiles")
    .select("id")
    .eq("id", order.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!profile) return { ok: false, reason: "not_found" };
  return { ok: true, expectedTiyin: usdToTiyin(PLANS_USD[order.plan].amount) };
}

/** Apply the paid order: activate the subscription or hold escrow money. */
export async function fulfillOrder(admin: Admin, order: OrderRef, meta: ProviderMeta): Promise<void> {
  const uzs = Math.round(meta.amountTiyin / 100);

  if (order.kind === "deal") {
    const { data: deal, error } = await admin
      .from("deals")
      .select("id, status, agreed_price, brand_id")
      .eq("id", order.dealId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!deal) throw new Error("Deal disappeared before fulfillment");

    const amountCents = Math.round(Number(deal.agreed_price) * 100);
    const { feeCents, payoutCents } = splitEscrow(amountCents);
    const { data: brand } = await admin
      .from("brand_profiles")
      .select("user_id")
      .eq("id", deal.brand_id)
      .maybeSingle();

    const { error: payErr } = await admin.from("deal_payments").insert({
      deal_id: deal.id,
      brand_user_id: brand?.user_id ?? null,
      amount_cents: amountCents,
      fee_cents: feeCents,
      payout_cents: payoutCents,
      provider: meta.provider,
      provider_ref: meta.providerRef,
      status: "held",
    });
    if (payErr) throw new Error(payErr.message);

    const { error: dealErr } = await admin
      .from("deals")
      .update({ status: "funded" })
      .eq("id", deal.id)
      .eq("status", "pending");
    if (dealErr) throw new Error(dealErr.message);

    await admin.from("payments").insert({
      user_id: brand?.user_id ?? null,
      amount: uzs,
      currency: "UZS",
      status: "succeeded",
      provider: meta.provider,
      provider_ref: meta.providerRef,
      deal_id: deal.id,
    });
    return;
  }

  const { error: subErr } = await admin.from("subscriptions").insert({
    user_id: order.userId,
    plan_type: order.plan,
    status: "active",
    expires_at: planExpiry(order.plan),
  });
  if (subErr) throw new Error(subErr.message);
  await admin.from("payments").insert({
    user_id: order.userId,
    plan_type: order.plan,
    amount: uzs,
    currency: "UZS",
    status: "succeeded",
    provider: meta.provider,
    provider_ref: meta.providerRef,
  });
}

/** Revert a fulfilled order after a provider-side refund/cancellation. */
export async function revertOrder(admin: Admin, order: OrderRef, meta: ProviderMeta): Promise<void> {
  if (order.kind === "deal") {
    await admin
      .from("deal_payments")
      .update({ status: "refunded" })
      .eq("deal_id", order.dealId)
      .eq("provider_ref", meta.providerRef);
    await admin
      .from("deals")
      .update({ status: "pending" })
      .eq("id", order.dealId)
      .eq("status", "funded");
  } else {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("id")
      .eq("user_id", order.userId)
      .eq("plan_type", order.plan)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub) {
      await admin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id);
    }
  }
  await admin
    .from("payments")
    .update({ status: "refunded" })
    .eq("provider", meta.provider)
    .eq("provider_ref", meta.providerRef);
}
