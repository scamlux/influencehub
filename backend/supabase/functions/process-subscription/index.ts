// process-subscription
// Handles Stripe (primary) / PayMe (secondary) checkout for a plan, then
// activates the subscription row in the DB and records a payment.
//
// Body: { plan_type: "brand_pro" | "influencer_sync" | "influencer_feature",
//         provider?: "stripe" | "payme", success_url?, cancel_url? }
//
// In live mode it creates a Stripe Checkout Session and returns its URL.
// If STRIPE_SECRET_KEY is absent (local/mock), it immediately activates the
// subscription and returns { activated: true } so the UI flow still completes.

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient, getUser } from "../_shared/client.ts";

type PlanType = "brand_pro" | "influencer_sync" | "influencer_feature";

const PLANS: Record<PlanType, { amount: number; cadence: "month" | "day" }> = {
  brand_pro: { amount: 29, cadence: "month" },
  influencer_sync: { amount: 5, cadence: "month" },
  influencer_feature: { amount: 10, cadence: "day" },
};

function expiryFor(plan: PlanType): string {
  const d = new Date();
  if (PLANS[plan].cadence === "day") d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { plan_type, provider = "stripe", success_url, cancel_url } =
      await req.json();

    if (!plan_type || !(plan_type in PLANS)) {
      return json({ error: "Invalid plan_type" }, 400);
    }
    const plan = plan_type as PlanType;
    const admin = adminClient();
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    // ── Live Stripe checkout ────────────────────────────────────────────────
    if (provider === "stripe" && stripeKey) {
      const params = new URLSearchParams();
      params.set("mode", PLANS[plan].cadence === "day" ? "payment" : "subscription");
      params.set("success_url", success_url ?? "https://influencehub.app/success");
      params.set("cancel_url", cancel_url ?? "https://influencehub.app/cancel");
      params.set("client_reference_id", user.id);
      params.set("metadata[plan_type]", plan);
      params.set("metadata[user_id]", user.id);
      params.set("line_items[0][quantity]", "1");
      params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(PLANS[plan].amount * 100));
      params.set("line_items[0][price_data][product_data][name]", plan);
      if (PLANS[plan].cadence !== "day") {
        params.set("line_items[0][price_data][recurring][interval]", PLANS[plan].cadence);
      }

      const resp = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      });
      const session = await resp.json();
      if (!resp.ok) return json({ error: session.error?.message ?? "Stripe error" }, 502);

      await admin.from("payments").insert({
        user_id: user.id,
        stripe_session_id: session.id,
        plan_type: plan,
        amount: PLANS[plan].amount,
        currency: "USD",
        status: "pending",
      });
      return json({ checkout_url: session.url, session_id: session.id });
    }

    // ── PayMe stub (Uzbekistan) ─────────────────────────────────────────────
    if (provider === "payme") {
      const merchant = Deno.env.get("PAYME_MERCHANT_ID");
      if (!merchant) {
        // fall through to direct activation below when not configured
      } else {
        const amountTiyin = PLANS[plan].amount * 100 * 12650; // ~USD→UZS demo rate
        const payload = btoa(
          `m=${merchant};ac.user_id=${user.id};ac.plan=${plan};a=${amountTiyin}`,
        );
        return json({ checkout_url: `https://checkout.paycom.uz/${payload}` });
      }
    }

    // ── Mock / no-provider path: activate immediately ───────────────────────
    const expires_at = expiryFor(plan);
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan_type: plan,
      status: "active",
      expires_at,
    });
    if (error) return json({ error: error.message }, 500);

    await admin.from("payments").insert({
      user_id: user.id,
      plan_type: plan,
      amount: PLANS[plan].amount,
      currency: "USD",
      status: "succeeded",
    });

    return json({ activated: true, plan_type: plan, expires_at });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
