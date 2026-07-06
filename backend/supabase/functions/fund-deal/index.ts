// fund-deal — brand starts escrow funding for a deal (T-14).
//
// Body: { deal_id: string, provider?: "payme" | "click" | "stripe" }
// Returns either { checkout_url } (redirect the browser to the provider) or
// { funded: true } when no provider is configured — the demo/sandbox path
// funds the escrow directly so the full flow stays demoable without keys.
//
// The caller must be the brand that owns the deal, and the deal must be in
// status "pending". Actual money capture is confirmed by the provider's
// webhook (payme-webhook / click-webhook / stripe-webhook), which calls the
// shared fulfillOrder().

import Stripe from "npm:stripe@16";
import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient, getUser } from "../_shared/client.ts";
import { fulfillOrder, validateOrder } from "../_shared/fulfill.ts";
import { clientIp, rateLimit, tooManyRequests } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const rl = rateLimit(`fund-deal:${clientIp(req)}`, { limit: 20, windowSec: 60 });
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { deal_id, provider = "stripe", success_url, cancel_url } = await req.json();
    if (!deal_id) return json({ error: "deal_id is required" }, 400);

    const admin = adminClient();
    const { data: deal, error } = await admin
      .from("deals")
      .select("id, status, agreed_price, brand_id")
      .eq("id", deal_id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!deal) return json({ error: "Deal not found" }, 404);

    const { data: brand } = await admin
      .from("brand_profiles")
      .select("user_id")
      .eq("id", deal.brand_id)
      .maybeSingle();
    if (brand?.user_id !== user.id) return json({ error: "Only the deal's brand can fund it" }, 403);

    const order = { kind: "deal", dealId: deal.id } as const;
    const v = await validateOrder(admin, order);
    if (!v.ok) return json({ error: "Deal is not awaiting funding" }, 409);

    // ── Payme hosted checkout ────────────────────────────────────────────────
    if (provider === "payme") {
      const merchant = Deno.env.get("PAYME_MERCHANT_ID");
      if (merchant) {
        const payload = btoa(`m=${merchant};ac.deal_id=${deal.id};a=${v.expectedTiyin}`);
        return json({ checkout_url: `https://checkout.paycom.uz/${payload}` });
      }
    }

    // ── Click hosted checkout ────────────────────────────────────────────────
    if (provider === "click") {
      const serviceId = Deno.env.get("CLICK_SERVICE_ID");
      const merchantId = Deno.env.get("CLICK_MERCHANT_ID");
      if (serviceId && merchantId) {
        const amountUzs = (v.expectedTiyin / 100).toFixed(2);
        const url =
          `https://my.click.uz/services/pay?service_id=${serviceId}` +
          `&merchant_id=${merchantId}&amount=${amountUzs}` +
          `&transaction_param=${encodeURIComponent(`deal:${deal.id}`)}`;
        return json({ checkout_url: url });
      }
    }

    // ── Stripe checkout (one-off payment, USD) ───────────────────────────────
    if (provider === "stripe") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, {
          apiVersion: "2024-06-20",
          httpClient: Stripe.createFetchHttpClient(),
        });
        const origin = req.headers.get("origin") ?? "http://localhost:5173";
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: Math.round(Number(deal.agreed_price) * 100),
                product_data: { name: `Deal escrow #${String(deal.id).slice(0, 8)}` },
              },
              quantity: 1,
            },
          ],
          metadata: { deal_id: deal.id, user_id: user.id },
          success_url: success_url ?? `${origin}/brand/deals?funded=1`,
          cancel_url: cancel_url ?? `${origin}/brand/deals`,
        });
        await admin.from("payments").insert({
          user_id: user.id,
          stripe_session_id: session.id,
          amount: Number(deal.agreed_price),
          currency: "USD",
          status: "pending",
          provider: "stripe",
          deal_id: deal.id,
        });
        return json({ checkout_url: session.url });
      }
    }

    // ── No provider configured: fund directly (demo/sandbox parity) ─────────
    await fulfillOrder(admin, order, {
      provider: "mock",
      providerRef: `direct-${deal.id}`,
      amount: Number(deal.agreed_price),
      currency: "USD",
    });
    return json({ funded: true });
  } catch (e) {
    console.error("fund-deal failure:", e);
    return json({ error: String(e) }, 500);
  }
});
