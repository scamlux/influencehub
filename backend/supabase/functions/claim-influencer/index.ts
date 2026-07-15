// claim-influencer
// Proof-of-ownership flow that links a scraped (user_id = null) influencer
// profile to the authenticated creator who actually owns it. It never
// auto-grants: a claim is only completed when we can prove control of the
// underlying social account (or an admin approves it).
//
// Actions (POST body):
//   { action: "initiate", influencer_id }
//       → creates a pending claim, returns a one-time verification_code to place
//         in the channel description / bio, plus where to place it.
//   { action: "verify", influencer_id }
//       → re-reads the live profile. YouTube: auto-verifies by finding the code
//         in the channel description and links the profile. Other platforms:
//         parks the claim as pending_admin (we cannot yet read them live).
//   { action: "admin_approve", claim_id }
//       → admin-only; approves a pending_admin claim and links the profile.
//
// The claimant is never written as admin_id anywhere — the influencer_claims
// row is the audit trail.

import { handleOptions, json } from "../_shared/cors.ts";
import { adminClient, getUser } from "../_shared/client.ts";

const YT_KEY =
  Deno.env.get("YOUTUBE_DATA_API_KEY") ?? Deno.env.get("YOUTUBE_API_KEY") ?? "";

// Human-readable, hard-to-guess code the creator pastes into their profile.
function makeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `INFLUENCEHUB-VERIFY-${hex.toUpperCase()}`;
}

function whereToPut(platform: string | null): string {
  switch (platform) {
    case "youtube":
      return "Add this code anywhere in your YouTube channel description (About tab), then press Verify.";
    case "instagram":
      return "Add this code to your Instagram bio, then submit — an admin will confirm it.";
    case "tiktok":
      return "Add this code to your TikTok bio, then submit — an admin will confirm it.";
    case "telegram":
      return "Add this code to your Telegram channel description, then submit — an admin will confirm it.";
    default:
      return "Add this code to your public profile, then submit for verification.";
  }
}

// Extract a YouTube channel id from a stored profile_url, if present.
function youtubeChannelId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/channel\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Read a YouTube channel description via the Data API.
async function youtubeDescription(channelId: string): Promise<string | null> {
  if (!YT_KEY) return null;
  const url =
    `https://www.googleapis.com/youtube/v3/channels?part=snippet` +
    `&id=${encodeURIComponent(channelId)}&key=${YT_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.error) throw new Error(`YouTube channels: ${d.error.message}`);
  return d.items?.[0]?.snippet?.description ?? "";
}

type Admin = ReturnType<typeof adminClient>;

// Load the profile and its primary social row (youtube preferred).
async function loadTarget(admin: Admin, influencerId: string) {
  const { data: profile } = await admin
    .from("influencer_profiles")
    .select("id, user_id")
    .eq("id", influencerId)
    .maybeSingle();
  if (!profile) return null;

  const { data: socials } = await admin
    .from("social_platforms")
    .select("platform, profile_url, is_primary")
    .eq("influencer_id", influencerId);

  const rows = socials ?? [];
  const primary =
    rows.find((s) => s.platform === "youtube") ??
    rows.find((s) => s.is_primary) ??
    rows[0] ??
    null;

  return { profile, primary };
}

async function linkProfile(admin: Admin, influencerId: string, userId: string) {
  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "influencer" }, { onConflict: "user_id" });
  const { error } = await admin
    .from("influencer_profiles")
    .update({ user_id: userId })
    .eq("id", influencerId);
  if (error) throw new Error(error.message);
}

Deno.serve(async (req) => {
  const pre = handleOptions(req);
  if (pre) return pre;

  try {
    const user = await getUser(req);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "initiate";
    const admin = adminClient();

    // ── admin_approve ────────────────────────────────────────────────────────
    if (action === "admin_approve") {
      // Verify the caller is an admin (their real role, not a claim).
      const { data: roleRow } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleRow?.role !== "admin") return json({ error: "Forbidden" }, 403);

      const claimId = body.claim_id;
      if (!claimId) return json({ error: "claim_id is required" }, 400);

      const { data: claim } = await admin
        .from("influencer_claims")
        .select("id, influencer_id, user_id, status")
        .eq("id", claimId)
        .maybeSingle();
      if (!claim) return json({ error: "Claim not found" }, 404);
      if (claim.status !== "pending_admin") {
        return json({ error: `Claim is ${claim.status}, not pending_admin` }, 409);
      }

      const target = await loadTarget(admin, claim.influencer_id);
      if (target?.profile.user_id && target.profile.user_id !== claim.user_id) {
        await admin
          .from("influencer_claims")
          .update({ status: "rejected" })
          .eq("id", claim.id);
        return json({ error: "Profile already claimed" }, 409);
      }

      await linkProfile(admin, claim.influencer_id, claim.user_id);
      await admin
        .from("influencer_claims")
        .update({ status: "verified", verified_at: new Date().toISOString() })
        .eq("id", claim.id);
      return json({ claimed: true, influencer_id: claim.influencer_id });
    }

    // Both initiate and verify need a target influencer.
    const influencerId = body.influencer_id;
    if (!influencerId) return json({ error: "influencer_id is required" }, 400);

    const target = await loadTarget(admin, influencerId);
    if (!target) return json({ error: "Influencer not found" }, 404);
    const { profile, primary } = target;
    const platform = primary?.platform ?? null;

    if (profile.user_id && profile.user_id !== user.id) {
      return json({ error: "This profile is already claimed" }, 409);
    }
    if (profile.user_id === user.id) {
      return json({ claimed: true, influencer_id: influencerId, already: true });
    }

    // ── initiate ───────────────────────────────────────────────────────────
    if (action === "initiate") {
      const code = makeCode();
      // Replace any prior live attempt by this user for this profile.
      await admin
        .from("influencer_claims")
        .delete()
        .eq("influencer_id", influencerId)
        .eq("user_id", user.id)
        .in("status", ["pending_code", "pending_admin"]);

      const { error: insErr } = await admin.from("influencer_claims").insert({
        influencer_id: influencerId,
        user_id: user.id,
        platform,
        verification_code: code,
        status: "pending_code",
      });
      if (insErr) return json({ error: insErr.message }, 500);

      return json({
        status: "pending_code",
        verification_code: code,
        platform,
        instructions: whereToPut(platform),
      });
    }

    // ── verify ───────────────────────────────────────────────────────────────
    if (action === "verify") {
      const { data: claim } = await admin
        .from("influencer_claims")
        .select("id, verification_code, status, expires_at")
        .eq("influencer_id", influencerId)
        .eq("user_id", user.id)
        .in("status", ["pending_code", "pending_admin"])
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (!claim) return json({ error: "No active claim — call initiate first" }, 404);
      if (new Date(claim.expires_at) < new Date()) {
        await admin
          .from("influencer_claims")
          .update({ status: "expired" })
          .eq("id", claim.id);
        return json({ error: "Verification code expired — start again" }, 410);
      }

      // YouTube: we can read the live description, so auto-verify.
      if (platform === "youtube") {
        const channelId = youtubeChannelId(primary?.profile_url ?? null);
        if (!channelId || !YT_KEY) {
          return json({ status: "pending_admin", reason: "youtube_unavailable" });
        }
        const description = await youtubeDescription(channelId);
        if (description && description.includes(claim.verification_code)) {
          await linkProfile(admin, influencerId, user.id);
          await admin
            .from("influencer_claims")
            .update({ status: "verified", verified_at: new Date().toISOString() })
            .eq("id", claim.id);
          return json({ claimed: true, influencer_id: influencerId, method: "youtube" });
        }
        return json({
          status: "pending_code",
          verified: false,
          reason: "code_not_found",
          instructions: whereToPut(platform),
        });
      }

      // Platforms we cannot yet read live → queue for admin approval. Never
      // auto-grant.
      await admin
        .from("influencer_claims")
        .update({ status: "pending_admin" })
        .eq("id", claim.id);
      return json({ status: "pending_admin" });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
