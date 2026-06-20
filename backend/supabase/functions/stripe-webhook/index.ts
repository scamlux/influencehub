// stripe-webhook
// Verifies Stripe webhook signatures and activates the subscription when a
// Checkout Session completes (the hosted checkout only redirects the browser;
// this is what actually grants the plan).
//
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
// Register with verify_jwt = false (Stripe sends no Supabase JWT).
//
// In the Stripe dashboard add an endpoint:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
//   event: checkout.session.completed
// then put the signing secret in STRIPE_WEBHOOK_SECRET.

import Stripe from "npm:stripe@16";
import { adminClient } from "../_shared/client.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const PLAN_CADENCE: Record<string, "month" | "day"> = {
  brand_pro: "month",
  influencer_sync: "month",
  influencer_feature: "day",
};

function expiryFor(plan: string): string {
  const d = new Date();
  if (PLAN_CADENCE[plan] === "day") d.setDate(d.getDate() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!sig) return new Response("missing stripe-signature", { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (e) {
    return new Response(`signature verification failed: ${(e as Error).message}`, {
      status: 400,
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = (session.metadata?.user_id ?? session.client_reference_id) as string | null;
    const plan = session.metadata?.plan_type as string | undefined;

    if (userId && plan && PLAN_CADENCE[plan]) {
      const admin = adminClient();
      await admin.from("subscriptions").insert({
        user_id: userId,
        plan_type: plan,
        status: "active",
        expires_at: expiryFor(plan),
        stripe_subscription_id: (session.subscription as string | null) ?? null,
      });
      await admin
        .from("payments")
        .update({ status: "succeeded" })
        .eq("stripe_session_id", session.id);
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
