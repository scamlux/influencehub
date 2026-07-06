// release-deal — release escrowed money to the influencer (T-13/T-14/T-15).
//
// Body: { deal_id: string, resolution?: "released" | "refunded" }
//
// Who may call:
//   • the deal's brand — approve a "delivered" deal → released
//   • an admin — resolve a "disputed" deal → released (pay the influencer)
//     or refunded (money back to the brand, deal → cancelled)
//
// Releasing marks deal_payments.status = released and enqueues a payout row
// (status pending) that admins settle manually from the Payments panel.

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient, getUser } from "../_shared/client.ts";
import { clientIp, rateLimit, tooManyRequests } from "../_shared/rate-limit.ts";

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  const rl = rateLimit(`release-deal:${clientIp(req)}`, {
    limit: 20,
    windowSec: 60,
  });
  if (!rl.allowed) return tooManyRequests(rl.retryAfterSec);

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { deal_id, resolution = "released" } = await req.json();
    if (!deal_id) return json({ error: "deal_id is required" }, 400);
    if (!["released", "refunded"].includes(resolution)) {
      return json({ error: "Invalid resolution" }, 400);
    }

    const admin = adminClient();
    const { data: deal, error } = await admin
      .from("deals")
      .select("id, status, brand_id, influencer_id")
      .eq("id", deal_id)
      .maybeSingle();
    if (error) return json({ error: error.message }, 500);
    if (!deal) return json({ error: "Deal not found" }, 404);

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const isAdmin = roleRow?.role === "admin";

    const { data: brand } = await admin
      .from("brand_profiles")
      .select("user_id")
      .eq("id", deal.brand_id)
      .maybeSingle();
    const isDealBrand = brand?.user_id === user.id;

    const canRelease =
      (isDealBrand &&
        deal.status === "delivered" &&
        resolution === "released") ||
      (isAdmin && ["disputed", "delivered"].includes(deal.status));
    if (!canRelease)
      return json({ error: "Not allowed for this deal state" }, 403);

    const { data: payment } = await admin
      .from("deal_payments")
      .select("*")
      .eq("deal_id", deal.id)
      .eq("status", "held")
      .maybeSingle();
    if (!payment)
      return json({ error: "No held escrow payment for this deal" }, 409);

    if (resolution === "refunded") {
      await admin
        .from("deal_payments")
        .update({ status: "refunded" })
        .eq("id", payment.id);
      await admin
        .from("deals")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("id", deal.id);
      return json({ refunded: true });
    }

    const { error: relErr } = await admin
      .from("deal_payments")
      .update({ status: "released", released_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "held");
    if (relErr) return json({ error: relErr.message }, 500);

    const { error: payoutErr } = await admin.from("payouts").insert({
      deal_payment_id: payment.id,
      deal_id: deal.id,
      influencer_id: deal.influencer_id,
      amount_cents: payment.payout_cents,
      currency: payment.currency,
      status: "pending",
    });
    // Unique constraint on deal_payment_id keeps retries idempotent.
    if (payoutErr && !payoutErr.message.includes("duplicate")) {
      return json({ error: payoutErr.message }, 500);
    }

    await admin
      .from("deals")
      .update({ status: "released", completed_at: new Date().toISOString() })
      .eq("id", deal.id);

    return json({
      released: true,
      payout_cents: payment.payout_cents,
      fee_cents: payment.fee_cents,
    });
  } catch (e) {
    console.error("release-deal failure:", e);
    return json({ error: String(e) }, 500);
  }
});
