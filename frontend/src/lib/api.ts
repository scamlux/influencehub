import type { RealtimeChannel } from "@supabase/supabase-js";
import { mockDB, persist, resetMockDB } from "./mock-data";
import { supabase, USE_MOCK_DATA } from "./supabase";
import { uid } from "./utils";
import { splitEscrow } from "./plans";
import { canTransition, nextStatus, type DealAction } from "./deal-status";
import type {
  AdvertisingPrice,
  AnalyticsHistory,
  AuthUser,
  Bid,
  BrandProfile,
  Campaign,
  Deal,
  DealPayment,
  Discount,
  Payout,
  InfluencerContact,
  InfluencerFull,
  InfluencerProfile,
  Message,
  Notification,
  PlanType,
  ScrapingQueueItem,
  SocialPlatform,
  Subscription,
  UserRole,
} from "@/types";

// ─── tiny realtime event bus (mimics Supabase channels) ────────────────────────
type Listener = (payload: any) => void;
const channels = new Map<string, Set<Listener>>();

function subscribe(channel: string, cb: Listener): () => void {
  if (!channels.has(channel)) channels.set(channel, new Set());
  channels.get(channel)!.add(cb);
  return () => channels.get(channel)?.delete(cb);
}
function emit(channel: string, payload: any) {
  channels.get(channel)?.forEach((cb) => cb(payload));
}

// simulate small network latency
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms));
function save() {
  persist(mockDB);
}

// ─── auth ──────────────────────────────────────────────────────────────────────
const SESSION_KEY = "influencehub_session";

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function toAuthUser(userId: string): AuthUser | null {
  const profile = mockDB.profiles.find((p) => p.id === userId);
  if (!profile) return null;
  const role = mockDB.user_roles.find((r) => r.user_id === userId)?.role ?? null;
  return {
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    role,
    is_active: profile.is_active,
  };
}

// Resolve a full AuthUser from a Supabase auth user: pulls full_name/is_active
// from `profiles` and the role from `user_roles` (both readable by the owner).
async function resolveAuthUser(
  id: string,
  email: string,
  metaFullName?: string,
): Promise<AuthUser> {
  let full_name = metaFullName ?? "";
  let is_active = true;
  let role: UserRole | null = null;
  if (supabase) {
    const [{ data: profile }, { data: roleRow }] = await Promise.all([
      supabase.from("profiles").select("full_name, email, is_active").eq("id", id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", id).maybeSingle(),
    ]);
    if (profile) {
      full_name = profile.full_name ?? full_name;
      email = profile.email ?? email;
      is_active = profile.is_active ?? true;
    }
    role = (roleRow?.role ?? null) as UserRole | null;
  }
  return { id, email, full_name, role, is_active };
}

export const auth = {
  async getUser(): Promise<AuthUser | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data } = await supabase.auth.getUser();
      const u = data.user;
      if (!u) return null;
      return resolveAuthUser(u.id, u.email ?? "", u.user_metadata?.full_name as string | undefined);
    }
    const uidv = getSessionUserId();
    return uidv ? toAuthUser(uidv) : null;
  },

  async login(email: string, password: string): Promise<AuthUser> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      const u = await resolveAuthUser(
        data.user.id,
        data.user.email ?? email,
        data.user.user_metadata?.full_name as string | undefined,
      );
      if (!u.is_active) {
        await supabase.auth.signOut();
        throw new Error("This account has been deactivated");
      }
      return u;
    }
    await wait();
    const profile = mockDB.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
    if (!profile) throw new Error("No account found with that email");
    if (!profile.is_active) throw new Error("This account has been deactivated");
    localStorage.setItem(SESSION_KEY, profile.id);
    return toAuthUser(profile.id)!;
  },

  async loginWithGoogle(): Promise<AuthUser> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw new Error(error.message);
      // The browser redirects to Google; this promise never resolves in practice.
      return new Promise<AuthUser>(() => {});
    }
    // demo: log in as a brand without a role to exercise /choose-role,
    // or fall back to seeded brand
    await wait();
    const brand = mockDB.profiles.find((p) => p.email === "brand@influencehub.uz")!;
    localStorage.setItem(SESSION_KEY, brand.id);
    return toAuthUser(brand.id)!;
  },

  async register(params: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
  }): Promise<AuthUser> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: params.email,
        password: params.password,
        options: { data: { full_name: params.full_name } },
      });
      if (error) throw new Error(error.message);
      const userId = data.user?.id;
      // With email confirmations enabled, signUp returns no session and the
      // RLS-protected inserts below would fail — surface a clear message.
      if (!userId || !data.session) {
        throw new Error(
          "Check your email to confirm your account, then sign in. " +
            "(Disable email confirmations in Supabase to auto-activate.)",
        );
      }
      // handle_new_user trigger already created the profiles row; add role + the
      // role-specific profile (RLS lets the owner insert their own).
      await supabase.from("user_roles").insert({ user_id: userId, role: params.role });
      if (params.role === "brand") {
        await supabase.from("brand_profiles").insert({ user_id: userId });
      } else if (params.role === "influencer") {
        await supabase.from("influencer_profiles").insert({
          user_id: userId,
          display_name: params.full_name,
          is_visible: false,
          onboarding_status: "pending",
        });
      }
      return resolveAuthUser(userId, params.email, params.full_name);
    }
    await wait();
    if (mockDB.profiles.some((p) => p.email.toLowerCase() === params.email.toLowerCase())) {
      throw new Error("An account with this email already exists");
    }
    const userId = uid();
    mockDB.profiles.push({
      id: userId,
      full_name: params.full_name,
      email: params.email,
      is_active: true,
      created_at: new Date().toISOString(),
    });
    mockDB.user_roles.push({
      id: uid(),
      user_id: userId,
      role: params.role,
      created_at: new Date().toISOString(),
    });
    if (params.role === "brand") {
      mockDB.brand_profiles.push({
        id: uid(),
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    } else if (params.role === "influencer") {
      mockDB.influencer_profiles.push({
        id: uid(),
        user_id: userId,
        display_name: params.full_name,
        bio: null,
        category: "lifestyle",
        city: null,
        is_visible: false,
        league_rank: null,
        avatar_url: null,
        onboarding_status: "pending",
        collection_error: null,
        engagement_rate: null,
        created_at: new Date().toISOString(),
      });
    }
    save();
    localStorage.setItem(SESSION_KEY, userId);
    return toAuthUser(userId)!;
  },

  async setRole(userId: string, role: UserRole): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      // user_roles UPDATE is admin-only by RLS, so only insert when absent
      // (the choose-role flow is for brand-new users without a role yet).
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (!existing) await supabase.from("user_roles").insert({ user_id: userId, role });

      if (role === "brand") {
        const { data: bp } = await supabase
          .from("brand_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!bp) await supabase.from("brand_profiles").insert({ user_id: userId });
      } else if (role === "influencer") {
        const { data: ip } = await supabase
          .from("influencer_profiles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!ip)
          await supabase.from("influencer_profiles").insert({
            user_id: userId,
            display_name: "New Creator",
            is_visible: false,
            onboarding_status: "pending",
          });
      }
      return;
    }
    const existing = mockDB.user_roles.find((r) => r.user_id === userId);
    if (existing) existing.role = role;
    else
      mockDB.user_roles.push({
        id: uid(),
        user_id: userId,
        role,
        created_at: new Date().toISOString(),
      });
    if (role === "brand" && !mockDB.brand_profiles.some((b) => b.user_id === userId)) {
      mockDB.brand_profiles.push({
        id: uid(),
        user_id: userId,
        created_at: new Date().toISOString(),
      });
    }
    if (role === "influencer" && !mockDB.influencer_profiles.some((i) => i.user_id === userId)) {
      mockDB.influencer_profiles.push({
        id: uid(),
        user_id: userId,
        display_name: toAuthUser(userId)?.full_name ?? "New Creator",
        bio: null,
        category: "lifestyle",
        city: null,
        is_visible: false,
        league_rank: null,
        avatar_url: null,
        onboarding_status: "pending",
        collection_error: null,
        engagement_rate: null,
        created_at: new Date().toISOString(),
      });
    }
    save();
  },

  async logout(): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      await supabase.auth.signOut();
      return;
    }
    localStorage.removeItem(SESSION_KEY);
  },

  async sendResetEmail(email: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message);
      return;
    }
    await wait();
  },

  async resetPassword(password: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      return;
    }
    await wait();
  },

  // Live session changes (login / logout / token refresh / OAuth return).
  // No-op in mock mode.
  onAuthChange(cb: (user: AuthUser | null) => void): () => void {
    if (!USE_MOCK_DATA && supabase) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user) {
          cb(null);
          return;
        }
        const u = session.user;
        resolveAuthUser(u.id, u.email ?? "", u.user_metadata?.full_name as string | undefined).then(
          cb,
        );
      });
      return () => data.subscription.unsubscribe();
    }
    return () => {};
  },
};

// ─── influencers ────────────────────────────────────────────────────────────────
function isFeatured(userId: string | null): boolean {
  if (!userId) return false;
  return mockDB.subscriptions.some(
    (s) =>
      s.user_id === userId &&
      s.plan_type === "influencer_feature" &&
      s.status === "active" &&
      (!s.expires_at || new Date(s.expires_at) > new Date()),
  );
}

// Deterministic "recently synced" timestamp derived from the influencer id so
// it stays stable across reloads but looks fresh (within the last ~3 days).
function recentSyncedAt(infId: string): string {
  let h = 0;
  for (let i = 0; i < infId.length; i++) h = (h * 31 + infId.charCodeAt(i)) & 0x7fffffff;
  const minutesAgo = 15 + (h % (72 * 60)); // 15 min … 3 days
  return new Date(Date.now() - minutesAgo * 60000).toISOString();
}

function hydrateInfluencer(inf: InfluencerProfile): InfluencerFull {
  const platforms = mockDB.social_platforms.filter((p) => p.influencer_id === inf.id);
  const prices = mockDB.advertising_prices.filter((p) => p.influencer_id === inf.id);
  const contact = mockDB.influencer_contacts.find((c) => c.influencer_id === inf.id) ?? null;
  const discounts = mockDB.discounts.filter((d) => d.influencer_id === inf.id && d.is_active);
  const total_followers = platforms.reduce((s, p) => s + p.followers_count, 0);
  return {
    ...inf,
    platforms,
    prices,
    contact,
    discounts,
    total_followers,
    is_featured: isFeatured(inf.user_id),
    last_synced: platforms.length ? recentSyncedAt(inf.id) : inf.created_at,
  };
}

// ─── Supabase-backed read path (league + profile) ─────────────────────────────
// Active only when a real Supabase project is configured (USE_MOCK_DATA=false).
// Everything else in this file still runs on the mock layer; this just lets the
// public league / blogger profiles show the rows created by discover-influencers.
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));

// PostgREST embeds children as nested arrays. Map a joined row -> InfluencerFull,
// coercing numeric/bigint columns (which arrive as strings) back to numbers.
function mapInfluencerRow(row: any, featured: Set<string>): InfluencerFull {
  const platforms: SocialPlatform[] = (row.social_platforms ?? []).map((p: any) => ({
    ...p,
    followers_count: num(p.followers_count),
    engagement_rate: numOrNull(p.engagement_rate),
  }));
  const prices: AdvertisingPrice[] = (row.advertising_prices ?? []).map((p: any) => ({
    ...p,
    price_usd: num(p.price_usd),
  }));
  const discounts: Discount[] = (row.discounts ?? []).filter((d: any) => d.is_active);
  const contact: InfluencerContact | null = (row.influencer_contacts ?? [])[0] ?? null;
  const total_followers = platforms.reduce((s, p) => s + p.followers_count, 0);
  const last_synced = platforms.length
    ? platforms
        .map((p) => p.created_at)
        .sort()
        .slice(-1)[0]
    : row.created_at;

  return {
    id: row.id,
    user_id: row.user_id,
    display_name: row.display_name,
    bio: row.bio,
    category: row.category,
    city: row.city,
    country: row.country ?? null,
    is_visible: row.is_visible,
    league_rank: row.league_rank,
    avatar_url: row.avatar_url,
    onboarding_status: row.onboarding_status,
    collection_error: row.collection_error,
    engagement_rate: numOrNull(row.engagement_rate),
    created_at: row.created_at,
    platforms,
    prices,
    contact,
    discounts,
    total_followers,
    is_featured: row.user_id ? featured.has(row.user_id) : false,
    last_synced,
  };
}

const INFLUENCER_SELECT =
  "*, social_platforms(*), advertising_prices(*), influencer_contacts(*), discounts(*)";

// user_ids with an active influencer_feature subscription (best-effort; if RLS
// hides the table for anon, we just treat nobody as featured).
async function featuredUserIds(): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data } = await supabase
    .from("subscriptions")
    .select("user_id, plan_type, status, expires_at")
    .eq("plan_type", "influencer_feature")
    .eq("status", "active");
  const now = Date.now();
  return new Set(
    (data ?? [])
      .filter((s) => !s.expires_at || new Date(s.expires_at).getTime() > now)
      .map((s) => s.user_id as string),
  );
}

export const influencers = {
  async list(): Promise<InfluencerFull[]> {
    if (!USE_MOCK_DATA && supabase) {
      const [{ data, error }, featured] = await Promise.all([
        supabase
          .from("influencer_profiles")
          .select(INFLUENCER_SELECT)
          .eq("is_visible", true)
          .order("league_rank", { ascending: true, nullsFirst: false }),
        featuredUserIds(),
      ]);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapInfluencerRow(r, featured));
    }
    await wait(80);
    return mockDB.influencer_profiles
      .filter((i) => i.is_visible)
      .map(hydrateInfluencer)
      .sort((a, b) => (a.league_rank ?? 999) - (b.league_rank ?? 999));
  },

  async listAll(): Promise<InfluencerFull[]> {
    if (!USE_MOCK_DATA && supabase) {
      const [{ data, error }, featured] = await Promise.all([
        supabase
          .from("influencer_profiles")
          .select(INFLUENCER_SELECT)
          .order("league_rank", { ascending: true, nullsFirst: false }),
        featuredUserIds(),
      ]);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => mapInfluencerRow(r, featured));
    }
    await wait(80);
    return mockDB.influencer_profiles.map(hydrateInfluencer);
  },

  async get(id: string): Promise<InfluencerFull | null> {
    if (!USE_MOCK_DATA && supabase) {
      const [{ data, error }, featured] = await Promise.all([
        supabase.from("influencer_profiles").select(INFLUENCER_SELECT).eq("id", id).maybeSingle(),
        featuredUserIds(),
      ]);
      if (error) throw new Error(error.message);
      return data ? mapInfluencerRow(data, featured) : null;
    }
    await wait(80);
    const inf = mockDB.influencer_profiles.find((i) => i.id === id);
    return inf ? hydrateInfluencer(inf) : null;
  },

  async getByUser(userId: string): Promise<InfluencerFull | null> {
    if (!USE_MOCK_DATA && supabase) {
      const [{ data, error }, featured] = await Promise.all([
        supabase
          .from("influencer_profiles")
          .select(INFLUENCER_SELECT)
          .eq("user_id", userId)
          .maybeSingle(),
        featuredUserIds(),
      ]);
      if (error) throw new Error(error.message);
      return data ? mapInfluencerRow(data, featured) : null;
    }
    const inf = mockDB.influencer_profiles.find((i) => i.user_id === userId);
    return inf ? hydrateInfluencer(inf) : null;
  },

  async analytics(influencerId: string): Promise<AnalyticsHistory[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("influencer_analytics_history")
        .select("*")
        .eq("influencer_id", influencerId)
        .order("recorded_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []).map((a) => ({
        ...a,
        followers_count: num(a.followers_count),
        engagement_rate: numOrNull(a.engagement_rate),
      })) as AnalyticsHistory[];
    }
    await wait(60);
    return mockDB.analytics_history
      .filter((a) => a.influencer_id === influencerId)
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
  },

  async update(id: string, patch: Partial<InfluencerProfile>): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.from("influencer_profiles").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const inf = mockDB.influencer_profiles.find((i) => i.id === id);
    if (inf) Object.assign(inf, patch);
    save();
  },

  // pricing
  async savePrices(influencerId: string, prices: AdvertisingPrice[]): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      await supabase.from("advertising_prices").delete().eq("influencer_id", influencerId);
      if (prices.length) {
        const rows = prices.map((p) => ({
          influencer_id: p.influencer_id,
          ad_type: p.ad_type,
          price_usd: p.price_usd,
          description: p.description,
          duration: p.duration,
          delivery_days: p.delivery_days,
          is_public: p.is_public,
        }));
        const { error } = await supabase.from("advertising_prices").insert(rows);
        if (error) throw new Error(error.message);
      }
      return;
    }
    mockDB.advertising_prices = mockDB.advertising_prices.filter(
      (p) => p.influencer_id !== influencerId,
    );
    mockDB.advertising_prices.push(...prices);
    save();
  },
  async addPrice(price: Omit<AdvertisingPrice, "id" | "created_at">): Promise<AdvertisingPrice> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("advertising_prices")
        .insert(price)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { ...data, price_usd: num(data.price_usd) } as AdvertisingPrice;
    }
    const row: AdvertisingPrice = { ...price, id: uid(), created_at: new Date().toISOString() };
    mockDB.advertising_prices.push(row);
    save();
    return row;
  },
  async deletePrice(id: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.from("advertising_prices").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    mockDB.advertising_prices = mockDB.advertising_prices.filter((p) => p.id !== id);
    save();
  },

  // discounts
  async addDiscount(d: Omit<Discount, "id" | "created_at">): Promise<Discount> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.from("discounts").insert(d).select().single();
      if (error) throw new Error(error.message);
      return data as Discount;
    }
    const row: Discount = { ...d, id: uid(), created_at: new Date().toISOString() };
    mockDB.discounts.push(row);
    save();
    return row;
  },
  async deleteDiscount(id: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.from("discounts").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    mockDB.discounts = mockDB.discounts.filter((d) => d.id !== id);
    save();
  },

  // social platforms
  async addPlatform(p: Omit<SocialPlatform, "id" | "created_at">): Promise<SocialPlatform> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.from("social_platforms").insert(p).select().single();
      if (error) throw new Error(error.message);
      return {
        ...data,
        followers_count: num(data.followers_count),
        engagement_rate: numOrNull(data.engagement_rate),
      } as SocialPlatform;
    }
    const row: SocialPlatform = { ...p, id: uid(), created_at: new Date().toISOString() };
    mockDB.social_platforms.push(row);
    save();
    return row;
  },

  async saveContact(c: Omit<InfluencerContact, "id" | "created_at">): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { data: existing } = await supabase
        .from("influencer_contacts")
        .select("id")
        .eq("influencer_id", c.influencer_id)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("influencer_contacts").update(c).eq("id", existing.id)
        : await supabase.from("influencer_contacts").insert(c);
      if (error) throw new Error(error.message);
      return;
    }
    const existing = mockDB.influencer_contacts.find((x) => x.influencer_id === c.influencer_id);
    if (existing) Object.assign(existing, c);
    else mockDB.influencer_contacts.push({ ...c, id: uid(), created_at: new Date().toISOString() });
    save();
  },
};

export const brands = {
  async profileForUser(userId: string): Promise<BrandProfile | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("brand_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as BrandProfile) ?? null;
    }
    return mockDB.brand_profiles.find((b) => b.user_id === userId) ?? null;
  },
  async userForProfile(brandProfileId: string): Promise<string | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("brand_profiles")
        .select("user_id")
        .eq("id", brandProfileId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.user_id as string) ?? null;
    }
    return mockDB.brand_profiles.find((b) => b.id === brandProfileId)?.user_id ?? null;
  },
  // Display names for a set of brand profile ids (brand_profiles → profiles).
  async names(brandProfileIds: string[]): Promise<Record<string, string>> {
    const ids = [...new Set(brandProfileIds)];
    if (!ids.length) return {};
    if (!USE_MOCK_DATA && supabase) {
      const { data: brandRows, error } = await supabase
        .from("brand_profiles")
        .select("id, user_id")
        .in("id", ids);
      if (error) throw new Error(error.message);
      const userIds = (brandRows ?? []).map((b) => b.user_id as string);
      const { data: profileRows, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (pErr) throw new Error(pErr.message);
      const nameByUser = Object.fromEntries(
        (profileRows ?? []).map((p) => [p.id as string, p.full_name as string]),
      );
      return Object.fromEntries(
        (brandRows ?? []).map((b) => [b.id as string, nameByUser[b.user_id as string] ?? "Brand"]),
      );
    }
    const out: Record<string, string> = {};
    for (const id of ids) {
      const bp = mockDB.brand_profiles.find((b) => b.id === id);
      const profile = bp ? mockDB.profiles.find((p) => p.id === bp.user_id) : null;
      out[id] = profile?.full_name ?? "Brand";
    }
    return out;
  },
};

// ─── subscriptions ───────────────────────────────────────────────────────────────
export const subscriptions = {
  async forUser(userId: string): Promise<Subscription[]> {
    if (!USE_MOCK_DATA && supabase) {
      // RLS read_own_subscription (002_rls_policies.sql) scopes rows to the caller.
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Subscription[];
    }
    return mockDB.subscriptions
      .filter((s) => s.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
  async activeFor(userId: string): Promise<Subscription | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        // Deterministic pick when several rows are active (PostgREST row order
        // is unspecified otherwise): newest first, matching forUser.
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      // expires_at is filtered client-side (same approach as featuredUserIds).
      const now = Date.now();
      const live = ((data ?? []) as Subscription[]).filter(
        (s) => !s.expires_at || new Date(s.expires_at).getTime() > now,
      );
      return live[0] ?? null;
    }
    return (
      mockDB.subscriptions.find(
        (s) =>
          s.user_id === userId &&
          s.status === "active" &&
          (!s.expires_at || new Date(s.expires_at) > new Date()),
      ) ?? null
    );
  },
  async checkout(
    userId: string,
    plan: PlanType,
    provider: "stripe" | "payme" = "stripe",
  ): Promise<Subscription | { redirected: true } | { activated: true }> {
    if (!USE_MOCK_DATA && supabase) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { data, error } = await supabase.functions.invoke("process-subscription", {
        body: {
          plan_type: plan,
          provider,
          success_url: `${origin}/brand/subscription?checkout=success`,
          cancel_url: `${origin}/brand/subscription?checkout=cancelled`,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      // Live Stripe/PayMe: redirect the browser to the hosted checkout page.
      if (data?.checkout_url) {
        window.location.href = data.checkout_url as string;
        return { redirected: true };
      }
      // No provider key configured → the function activated the sub directly.
      return { activated: true };
    }
    await wait(400); // simulate stripe redirect/processing
    const days = plan === "influencer_feature" ? 1 : 30;
    const sub: Subscription = {
      id: uid(),
      user_id: userId,
      plan_type: plan,
      status: "active",
      expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      stripe_subscription_id: `sub_mock_${Date.now()}`,
      created_at: new Date().toISOString(),
    };
    mockDB.subscriptions.push(sub);
    mockDB.payments.push({
      id: uid(),
      user_id: userId,
      stripe_session_id: `cs_mock_${Date.now()}`,
      plan_type: plan,
      amount: plan === "brand_pro" ? 29 : plan === "influencer_sync" ? 5 : 10,
      currency: "USD",
      status: "succeeded",
      created_at: new Date().toISOString(),
    });
    save();
    return sub;
  },
};

// ─── campaigns / bids / deals ─────────────────────────────────────────────────────
// Coerce numeric columns (returned as strings by PostgREST) back to numbers.
const mapCampaign = (r: any): Campaign => ({ ...r, budget_usd: num(r.budget_usd) });
const mapBid = (r: any): Bid => ({ ...r, proposed_price: num(r.proposed_price) });
const mapDeal = (r: any): Deal => ({
  ...r,
  agreed_price: num(r.agreed_price),
  rating: r.rating == null ? null : Number(r.rating),
});

export const campaigns = {
  async list(): Promise<Campaign[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCampaign);
    }
    await wait(80);
    return [...mockDB.campaigns].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  async open(): Promise<Campaign[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCampaign);
    }
    await wait(80);
    return mockDB.campaigns.filter((c) => c.status === "open");
  },
  async forBrand(brandId: string): Promise<Campaign[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapCampaign);
    }
    return mockDB.campaigns.filter((c) => c.brand_id === brandId);
  },
  async get(id: string): Promise<Campaign | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapCampaign(data) : null;
    }
    return mockDB.campaigns.find((c) => c.id === id) ?? null;
  },
  async create(c: Omit<Campaign, "id" | "created_at">): Promise<Campaign> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.from("campaigns").insert(c).select().single();
      if (error) throw new Error(error.message);
      return mapCampaign(data);
    }
    const row: Campaign = { ...c, id: uid(), created_at: new Date().toISOString() };
    mockDB.campaigns.push(row);
    save();
    return row;
  },
  async update(id: string, patch: Partial<Campaign>): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.from("campaigns").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const c = mockDB.campaigns.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    save();
  },
};

export const bids = {
  async forCampaign(campaignId: string): Promise<Bid[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapBid);
    }
    return mockDB.bids.filter((b) => b.campaign_id === campaignId);
  },
  async forInfluencer(influencerId: string): Promise<Bid[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("influencer_id", influencerId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapBid);
    }
    return mockDB.bids.filter((b) => b.influencer_id === influencerId);
  },
  async create(b: Omit<Bid, "id" | "created_at" | "status">): Promise<Bid> {
    if (!USE_MOCK_DATA && supabase) {
      // status defaults to 'pending' in the DB. The brand notification is handled
      // server-side (notifications has no client INSERT policy under RLS).
      const { data, error } = await supabase.from("bids").insert(b).select().single();
      if (error) throw new Error(error.message);
      return mapBid(data);
    }
    const row: Bid = { ...b, id: uid(), status: "pending", created_at: new Date().toISOString() };
    mockDB.bids.push(row);
    // notify brand
    const camp = mockDB.campaigns.find((c) => c.id === b.campaign_id);
    const brand = mockDB.brand_profiles.find((bp) => bp.id === camp?.brand_id);
    if (brand) {
      notifications.push(brand.user_id, {
        type: "bid_received",
        title: "New bid received",
        message: `A creator submitted a bid on ${camp?.title}.`,
        link: "/brand/campaigns",
      });
    }
    save();
    return row;
  },
  async accept(bidId: string): Promise<Deal> {
    if (!USE_MOCK_DATA && supabase) {
      // The brand (campaign owner) performs these steps; each is RLS-checked.
      const { data: bid, error: bidErr } = await supabase
        .from("bids")
        .select("id, campaign_id, influencer_id, proposed_price, campaigns(brand_id)")
        .eq("id", bidId)
        .single();
      if (bidErr || !bid) throw new Error(bidErr?.message ?? "Bid not found");
      const brandId = (bid as any).campaigns?.brand_id as string;

      await supabase.from("bids").update({ status: "accepted" }).eq("id", bidId);
      await supabase
        .from("bids")
        .update({ status: "rejected" })
        .eq("campaign_id", bid.campaign_id)
        .neq("id", bidId);
      await supabase.from("campaigns").update({ status: "active" }).eq("id", bid.campaign_id);

      const { data: deal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          bid_id: bid.id,
          campaign_id: bid.campaign_id,
          brand_id: brandId,
          influencer_id: bid.influencer_id,
          agreed_price: num(bid.proposed_price),
          status: "pending",
        })
        .select()
        .single();
      if (dealErr || !deal) throw new Error(dealErr?.message ?? "Could not create deal");
      return mapDeal(deal);
    }
    const bid = mockDB.bids.find((b) => b.id === bidId);
    if (!bid) throw new Error("Bid not found");
    bid.status = "accepted";
    const camp = mockDB.campaigns.find((c) => c.id === bid.campaign_id)!;
    // reject other bids
    mockDB.bids
      .filter((b) => b.campaign_id === bid.campaign_id && b.id !== bidId)
      .forEach((b) => (b.status = "rejected"));
    camp.status = "active";
    const deal: Deal = {
      id: uid(),
      bid_id: bid.id,
      campaign_id: camp.id,
      brand_id: camp.brand_id,
      influencer_id: bid.influencer_id,
      agreed_price: bid.proposed_price,
      status: "pending",
      content_url: null,
      completed_at: null,
      review: null,
      rating: null,
      created_at: new Date().toISOString(),
    };
    mockDB.deals.push(deal);
    // notify influencer
    const inf = mockDB.influencer_profiles.find((i) => i.id === bid.influencer_id);
    if (inf?.user_id) {
      notifications.push(inf.user_id, {
        type: "bid_accepted",
        title: "Your bid was accepted!",
        message: `Your bid on ${camp.title} was accepted. A new deal has been created.`,
        link: "/influencer/deals",
      });
    }
    save();
    return deal;
  },
  async reject(bidId: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.from("bids").update({ status: "rejected" }).eq("id", bidId);
      if (error) throw new Error(error.message);
      return;
    }
    const bid = mockDB.bids.find((b) => b.id === bidId);
    if (bid) bid.status = "rejected";
    save();
  },
  // Influencer withdraws their own still-pending bid (powers the Undo toast).
  async withdraw(bidId: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("bids")
        .delete()
        .eq("id", bidId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      return;
    }
    const i = mockDB.bids.findIndex((b) => b.id === bidId && b.status === "pending");
    if (i >= 0) mockDB.bids.splice(i, 1);
    save();
  },
};

export const deals = {
  async forBrand(brandId: string): Promise<Deal[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("brand_id", brandId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapDeal);
    }
    return mockDB.deals.filter((d) => d.brand_id === brandId);
  },
  async forInfluencer(influencerId: string): Promise<Deal[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .eq("influencer_id", influencerId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapDeal);
    }
    return mockDB.deals.filter((d) => d.influencer_id === influencerId);
  },
  async get(id: string): Promise<Deal | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapDeal(data) : null;
    }
    return mockDB.deals.find((d) => d.id === id) ?? null;
  },
  async submitContent(dealId: string, url: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("deals")
        .update({ content_url: url, status: "content_submitted" })
        .eq("id", dealId);
      if (error) throw new Error(error.message);
      return;
    }
    const d = mockDB.deals.find((x) => x.id === dealId);
    if (d) {
      d.content_url = url;
      d.status = "content_submitted";
      const brand = mockDB.brand_profiles.find((b) => b.id === d.brand_id);
      if (brand)
        notifications.push(brand.user_id, {
          type: "deal_update",
          title: "Content submitted",
          message: "A creator submitted content for your review.",
          link: "/brand/deals",
        });
    }
    save();
  },
  async setStatus(dealId: string, status: Deal["status"]): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const patch: Partial<Deal> = { status };
      if (status === "completed") patch.completed_at = new Date().toISOString();
      const { error } = await supabase.from("deals").update(patch).eq("id", dealId);
      if (error) throw new Error(error.message);
      return;
    }
    const d = mockDB.deals.find((x) => x.id === dealId);
    if (d) {
      d.status = status;
      if (status === "completed") d.completed_at = new Date().toISOString();
      const inf = mockDB.influencer_profiles.find((i) => i.id === d.influencer_id);
      if (inf?.user_id)
        notifications.push(inf.user_id, {
          type: "deal_update",
          title: "Deal updated",
          message: `Your deal status changed to "${status}".`,
          link: "/influencer/deals",
        });
    }
    save();
  },

  // ─── escrow (T-13 / T-14) ───────────────────────────────────────────────────
  async paymentFor(dealId: string): Promise<DealPayment | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("deal_payments")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as DealPayment) ?? null;
    }
    return [...mockDB.deal_payments].reverse().find((p) => p.deal_id === dealId) ?? null;
  },

  // Brand funds the deal into escrow. Live mode delegates to the fund-deal
  // edge function (which may return a provider checkout_url); mock mode holds
  // the money locally so the whole flow is demoable offline.
  async fund(
    dealId: string,
    opts: { provider?: "mock" | "stripe" | "payme" | "click" } = {},
  ): Promise<{ funded: boolean; checkout_url?: string }> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.functions.invoke("fund-deal", {
        body: { deal_id: dealId, provider: opts.provider ?? "stripe" },
      });
      if (error) throw new Error(error.message);
      return { funded: Boolean(data?.funded), checkout_url: data?.checkout_url };
    }
    const deal = mockDB.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Deal not found");
    if (!canTransition(deal.status, "fund", "brand")) {
      throw new Error(`Cannot fund a deal in status "${deal.status}"`);
    }
    const amountCents = Math.round(num(deal.agreed_price) * 100);
    const { feeCents, payoutCents } = splitEscrow(amountCents);
    const brand = mockDB.brand_profiles.find((b) => b.id === deal.brand_id);
    const now = new Date().toISOString();
    mockDB.deal_payments.push({
      id: uid(),
      deal_id: dealId,
      brand_user_id: brand?.user_id ?? null,
      amount_cents: amountCents,
      fee_cents: feeCents,
      payout_cents: payoutCents,
      currency: "USD",
      provider: opts.provider ?? "mock",
      provider_ref: `mock-${dealId}`,
      status: "held",
      held_at: now,
      released_at: null,
      created_at: now,
    });
    deal.status = "funded";
    const inf = mockDB.influencer_profiles.find((i) => i.id === deal.influencer_id);
    if (inf?.user_id)
      notifications.push(inf.user_id, {
        type: "deal_update",
        title: "Deal funded",
        message: "The brand funded this deal — you can start working.",
        link: "/influencer/deals",
      });
    save();
    return { funded: true };
  },

  // Generic non-funding transition (start / deliver / dispute / resolve_*).
  // Money side-effects (release, refund) are handled here in mock mode and by
  // the release-deal edge function in live mode.
  async advance(
    dealId: string,
    action: DealAction,
    role: UserRole,
    opts: { contentUrl?: string } = {},
  ): Promise<Deal> {
    const isReleaseLike = action === "release" || action === "resolve_release";
    const isRefund = action === "resolve_refund";

    if (!USE_MOCK_DATA && supabase) {
      if (isReleaseLike || isRefund) {
        const { error } = await supabase.functions.invoke("release-deal", {
          body: { deal_id: dealId, resolution: isRefund ? "refunded" : "released" },
        });
        if (error) throw new Error(error.message);
      } else {
        const target = nextStatus((await this.get(dealId))?.status ?? "pending", action);
        if (!target) throw new Error(`Illegal transition: ${action}`);
        const patch: Partial<Deal> = { status: target };
        if (opts.contentUrl) patch.content_url = opts.contentUrl;
        const { error } = await supabase.from("deals").update(patch).eq("id", dealId);
        if (error) throw new Error(error.message);
      }
      const updated = await this.get(dealId);
      if (!updated) throw new Error("Deal not found");
      return updated;
    }

    const deal = mockDB.deals.find((d) => d.id === dealId);
    if (!deal) throw new Error("Deal not found");
    if (!canTransition(deal.status, action, role)) {
      throw new Error(`Cannot ${action} a deal in status "${deal.status}" as ${role}`);
    }
    const target = nextStatus(deal.status, action)!;
    deal.status = target;
    if (opts.contentUrl) deal.content_url = opts.contentUrl;
    if (target === "released" || target === "completed") {
      deal.completed_at = new Date().toISOString();
    }

    // Money movement on release: mark escrow released + enqueue a payout.
    if (isReleaseLike) {
      const payment = [...mockDB.deal_payments]
        .reverse()
        .find((p) => p.deal_id === dealId && p.status === "held");
      if (payment) {
        payment.status = "released";
        payment.released_at = new Date().toISOString();
        if (!mockDB.payouts.some((p) => p.deal_payment_id === payment.id)) {
          mockDB.payouts.push({
            id: uid(),
            deal_payment_id: payment.id,
            deal_id: dealId,
            influencer_id: deal.influencer_id,
            amount_cents: payment.payout_cents,
            currency: payment.currency,
            status: "pending",
            paid_at: null,
            paid_by: null,
            note: null,
            created_at: new Date().toISOString(),
          });
        }
      }
    } else if (isRefund) {
      const payment = [...mockDB.deal_payments]
        .reverse()
        .find((p) => p.deal_id === dealId && p.status === "held");
      if (payment) payment.status = "refunded";
      deal.status = "cancelled";
    }

    // Notify the counterpart of the new status.
    const brand = mockDB.brand_profiles.find((b) => b.id === deal.brand_id);
    const inf = mockDB.influencer_profiles.find((i) => i.id === deal.influencer_id);
    const recipient = role === "brand" ? inf?.user_id : brand?.user_id;
    if (recipient)
      notifications.push(recipient, {
        type: "deal_update",
        title: "Deal updated",
        message: `Deal status changed to "${deal.status}".`,
        link: role === "brand" ? "/influencer/deals" : "/brand/deals",
      });
    save();
    return deal;
  },
};

// ─── messages (realtime chat) ──────────────────────────────────────────────────────
type TypingPayload = { userId: string };
const typingChannels = new Map<
  string,
  { ch: RealtimeChannel; listeners: Set<(p: TypingPayload) => void>; refs: number }
>();

export const messages = {
  async forDeal(dealId: string): Promise<Message[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as Message[];
    }
    return mockDB.messages
      .filter((m) => m.deal_id === dealId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  },
  async send(dealId: string, senderId: string, content: string): Promise<Message> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("messages")
        .insert({ deal_id: dealId, sender_id: senderId, content })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data as Message;
    }
    const msg: Message = {
      id: uid(),
      deal_id: dealId,
      sender_id: senderId,
      content,
      created_at: new Date().toISOString(),
    };
    mockDB.messages.push(msg);
    save();
    emit(`deal-${dealId}`, msg);
    // Mirror the 018_message_notifications.sql trigger: one unread "message"
    // notification per chat for the counterpart.
    const deal = mockDB.deals.find((d) => d.id === dealId);
    if (deal) {
      const brandUser = mockDB.brand_profiles.find((b) => b.id === deal.brand_id)?.user_id;
      const infUser = mockDB.influencer_profiles.find((i) => i.id === deal.influencer_id)?.user_id;
      const recipient = senderId === brandUser ? infUser : senderId === infUser ? brandUser : null;
      if (recipient) {
        const role = recipient === brandUser ? "brand" : "influencer";
        const link = `/${role}/chat/${dealId}`;
        const alreadyUnread = mockDB.notifications.some(
          (n) => n.user_id === recipient && n.type === "message" && n.link === link && !n.is_read,
        );
        if (!alreadyUnread) {
          notifications.push(recipient, {
            type: "message",
            title: "New message",
            message: content.slice(0, 120),
            link,
          });
        }
      }
    }
    return msg;
  },
  // Stream new messages for a deal. Supabase Realtime (postgres_changes, RLS-filtered)
  // when connected, otherwise the in-memory mock event bus.
  subscribeToDeal(dealId: string, cb: (m: Message) => void): () => void {
    if (!USE_MOCK_DATA && supabase) {
      const sb = supabase;
      // Unique topic per subscription: a shared name would let StrictMode's
      // double-mount call .on() on an already-subscribed channel (which throws).
      const ch = sb
        .channel(`messages:deal:${dealId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `deal_id=eq.${dealId}` },
          (payload) => cb(payload.new as Message),
        )
        .subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    }
    return subscribe(`deal-${dealId}`, cb);
  },
  // Ephemeral typing indicator over Realtime broadcast (nothing persisted).
  // Broadcast needs sender and listeners on one shared topic, so unlike the
  // postgres_changes subscriptions above the channel is refcounted per deal
  // instead of getting a unique suffix.
  subscribeTyping(dealId: string, cb: (p: TypingPayload) => void): () => void {
    if (!USE_MOCK_DATA && supabase) {
      const sb = supabase;
      let entry = typingChannels.get(dealId);
      if (!entry) {
        const listeners = new Set<(p: TypingPayload) => void>();
        const ch = sb
          .channel(`typing:deal:${dealId}`, { config: { broadcast: { self: false } } })
          .on("broadcast", { event: "typing" }, (msg) => {
            const p = msg.payload as TypingPayload;
            listeners.forEach((l) => l(p));
          })
          .subscribe();
        entry = { ch, listeners, refs: 0 };
        typingChannels.set(dealId, entry);
      }
      entry.refs += 1;
      entry.listeners.add(cb);
      return () => {
        const e = typingChannels.get(dealId);
        if (!e) return;
        e.listeners.delete(cb);
        e.refs -= 1;
        if (e.refs <= 0) {
          typingChannels.delete(dealId);
          sb.removeChannel(e.ch);
        }
      };
    }
    return subscribe(`typing-${dealId}`, cb);
  },
  async sendTyping(dealId: string, userId: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const entry = typingChannels.get(dealId);
      if (entry) {
        await entry.ch.send({ type: "broadcast", event: "typing", payload: { userId } });
      }
      return;
    }
    emit(`typing-${dealId}`, { userId });
  },
};

// ─── notifications (realtime) ──────────────────────────────────────────────────────
export const notifications = {
  async forUser(userId: string): Promise<Notification[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Notification[];
    }
    return mockDB.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
  // Mock-only: cross-user notifications are created by DB triggers under Supabase
  // (see migration 004_realtime.sql), so this is never used in live mode.
  push(
    userId: string,
    n: { type: string; title: string; message: string; link?: string },
  ): Notification {
    const row: Notification = {
      id: uid(),
      user_id: userId,
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    mockDB.notifications.push(row);
    save();
    emit(`user-notifications-${userId}`, row);
    return row;
  },
  async markRead(id: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const n = mockDB.notifications.find((x) => x.id === id);
    if (n) n.is_read = true;
    save();
  },
  // Mark all unread notifications pointing at a given in-app link as read
  // (e.g. clear the chat badge when the user opens that chat).
  async markReadByLink(userId: string, link: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("link", link)
        .eq("is_read", false);
      if (error) throw new Error(error.message);
      return;
    }
    const unread = mockDB.notifications.filter(
      (n) => n.user_id === userId && n.link === link && !n.is_read,
    );
    if (!unread.length) return;
    unread.forEach((n) => (n.is_read = true));
    save();
    emit(`user-notifications-${userId}`, null);
  },
  async markAllRead(userId: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw new Error(error.message);
      return;
    }
    mockDB.notifications.filter((n) => n.user_id === userId).forEach((n) => (n.is_read = true));
    save();
  },
  // Stream this user's notification inserts/updates.
  subscribeForUser(userId: string, cb: () => void): () => void {
    if (!USE_MOCK_DATA && supabase) {
      const sb = supabase;
      // Unique topic per subscription (see subscribeToDeal): avoids re-adding a
      // callback to an already-subscribed channel on StrictMode remounts.
      const ch = sb
        .channel(`notifications:user:${userId}:${crypto.randomUUID()}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => cb(),
        )
        .subscribe();
      return () => {
        sb.removeChannel(ch);
      };
    }
    return subscribe(`user-notifications-${userId}`, cb);
  },
};

// ─── favorites ─────────────────────────────────────────────────────────────────────
export const favorites = {
  async forUser(userId: string): Promise<string[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("favorites")
        .select("influencer_id")
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return (data ?? []).map((f) => f.influencer_id as string);
    }
    return mockDB.favorites.filter((f) => f.user_id === userId).map((f) => f.influencer_id);
  },
  async toggle(userId: string, influencerId: string): Promise<boolean> {
    if (!USE_MOCK_DATA && supabase) {
      const { data: existing } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", userId)
        .eq("influencer_id", influencerId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase.from("favorites").delete().eq("id", existing.id);
        if (error) throw new Error(error.message);
        return false;
      }
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: userId, influencer_id: influencerId });
      if (error) throw new Error(error.message);
      return true;
    }
    const idx = mockDB.favorites.findIndex(
      (f) => f.user_id === userId && f.influencer_id === influencerId,
    );
    if (idx >= 0) {
      mockDB.favorites.splice(idx, 1);
      save();
      return false;
    }
    mockDB.favorites.push({
      id: uid(),
      user_id: userId,
      influencer_id: influencerId,
      created_at: new Date().toISOString(),
    });
    save();
    return true;
  },
};

// ─── admin ─────────────────────────────────────────────────────────────────────────
export const admin = {
  async stats() {
    if (!USE_MOCK_DATA && supabase) {
      const head = { count: "exact" as const, head: true };
      const [users, influencers, camps, dls, pays] = await Promise.all([
        supabase.from("profiles").select("id", head),
        supabase.from("influencer_profiles").select("id", head),
        supabase.from("campaigns").select("id", head),
        supabase.from("deals").select("id", head),
        supabase.from("payments").select("amount"),
      ]);
      return {
        users: users.count ?? 0,
        influencers: influencers.count ?? 0,
        campaigns: camps.count ?? 0,
        deals: dls.count ?? 0,
        revenue: (pays.data ?? []).reduce((s, p) => s + num(p.amount), 0),
      };
    }
    return {
      users: mockDB.profiles.length,
      influencers: mockDB.influencer_profiles.length,
      campaigns: mockDB.campaigns.length,
      deals: mockDB.deals.length,
      revenue: mockDB.payments.reduce((s, p) => s + p.amount, 0),
    };
  },
  async allUsers() {
    if (!USE_MOCK_DATA && supabase) {
      const [{ data: profiles, error }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (error) throw new Error(error.message);
      const roleByUser = new Map((roles ?? []).map((r) => [r.user_id, r.role]));
      return (profiles ?? []).map((p) => ({ ...p, role: roleByUser.get(p.id) ?? null }));
    }
    return mockDB.profiles.map((p) => ({
      ...p,
      role: mockDB.user_roles.find((r) => r.user_id === p.id)?.role ?? null,
    }));
  },
  async toggleActive(userId: string) {
    if (!USE_MOCK_DATA && supabase) {
      const { data: cur } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle();
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !(cur?.is_active ?? true) })
        .eq("id", userId);
      if (error) throw new Error(error.message);
      return;
    }
    const p = mockDB.profiles.find((x) => x.id === userId);
    if (p) p.is_active = !p.is_active;
    save();
  },
  async setUserRole(userId: string, role: UserRole) {
    if (!USE_MOCK_DATA && supabase) {
      const { data: existing } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      const { error } = existing
        ? await supabase.from("user_roles").update({ role }).eq("user_id", userId)
        : await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw new Error(error.message);
      return;
    }
    const r = mockDB.user_roles.find((x) => x.user_id === userId);
    if (r) r.role = role;
    save();
  },
  async payments() {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((p) => ({ ...p, amount: num(p.amount) }));
    }
    return [...mockDB.payments].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  async allDeals(): Promise<Deal[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("deals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapDeal);
    }
    return [...mockDB.deals].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  // ─── payouts queue (T-15) ────────────────────────────────────────────────
  async payouts(): Promise<Payout[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Payout[];
    }
    return [...mockDB.payouts].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  async markPayoutPaid(payoutId: string, adminId: string, note?: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("payouts")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_by: adminId,
          note: note ?? null,
        })
        .eq("id", payoutId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      // Reflect the settled payout on its escrow record.
      const { data: payout } = await supabase
        .from("payouts")
        .select("deal_payment_id")
        .eq("id", payoutId)
        .maybeSingle();
      if (payout?.deal_payment_id) {
        await supabase
          .from("deal_payments")
          .update({ status: "paid_out" })
          .eq("id", payout.deal_payment_id);
      }
      return;
    }
    const payout = mockDB.payouts.find((p) => p.id === payoutId);
    if (!payout || payout.status !== "pending") return;
    payout.status = "paid";
    payout.paid_at = new Date().toISOString();
    payout.paid_by = adminId;
    payout.note = note ?? null;
    const payment = mockDB.deal_payments.find((p) => p.id === payout.deal_payment_id);
    if (payment) payment.status = "paid_out";
    const inf = mockDB.influencer_profiles.find((i) => i.id === payout.influencer_id);
    if (inf?.user_id)
      notifications.push(inf.user_id, {
        type: "payout",
        title: "You've been paid",
        message: `Your payout for a completed deal has been sent.`,
        link: "/influencer/deals",
      });
    save();
  },
  async allSubscriptions(): Promise<Subscription[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Subscription[];
    }
    return [...mockDB.subscriptions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  // Requires the admin update policy from migration 005 (clients can't otherwise
  // update subscriptions under RLS).
  async cancelSubscription(id: string): Promise<void> {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("subscriptions")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return;
    }
    const sub = mockDB.subscriptions.find((s) => s.id === id);
    if (sub) sub.status = "cancelled";
    save();
  },
  async auditLog() {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("admin_actions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    return [...mockDB.admin_actions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  async scrapingQueue(): Promise<ScrapingQueueItem[]> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase
        .from("scraping_queue")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as ScrapingQueueItem[];
    }
    return [...mockDB.scraping_queue].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },
  // Live: scraping_queue has no client INSERT policy under RLS — enqueueing
  // happens server-side, so this kicks the process-scraping-queue worker to
  // drain whatever is already pending (its header documents manual invocation
  // from the admin queue page). Mock: enqueue + simulated processing.
  async enqueueScrape(influencerId?: string): Promise<ScrapingQueueItem | null> {
    if (!USE_MOCK_DATA && supabase) {
      const { data, error } = await supabase.functions.invoke("process-scraping-queue", {
        body: { limit: 10 },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(String(data.error));
      return null;
    }
    if (!influencerId) return null;
    const item: ScrapingQueueItem = {
      id: uid(),
      influencer_id: influencerId,
      status: "pending",
      error: null,
      created_at: new Date().toISOString(),
    };
    mockDB.scraping_queue.push(item);
    save();
    emit("scraping-queue-admin", { type: "INSERT", item });
    // simulate processing
    setTimeout(() => {
      item.status = "processing";
      emit("scraping-queue-admin", { type: "UPDATE", item });
      save();
      setTimeout(() => {
        item.status = "completed";
        emit("scraping-queue-admin", { type: "UPDATE", item });
        save();
      }, 1500);
    }, 1200);
    return item;
  },
  // Stream queue changes to the admin page. scraping_queue is not in the
  // supabase_realtime publication (004_realtime.sql), so the live branch polls
  // instead of subscribing; the mock branch reuses the in-memory event bus.
  subscribeScrapingQueue(cb: () => void): () => void {
    if (!USE_MOCK_DATA && supabase) {
      const timer = setInterval(cb, 10_000);
      return () => clearInterval(timer);
    }
    return subscribe("scraping-queue-admin", cb);
  },
  async setInfluencerRank(influencerId: string, rank: number) {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("influencer_profiles")
        .update({ league_rank: rank })
        .eq("id", influencerId);
      if (error) throw new Error(error.message);
      return;
    }
    const inf = mockDB.influencer_profiles.find((i) => i.id === influencerId);
    if (inf) inf.league_rank = rank;
    save();
  },
  // Persist a drag-to-reorder change: write the new league_rank for every row
  // whose position changed (caller passes only the diffs).
  async reorderInfluencers(updates: { id: string; rank: number }[]) {
    if (!updates.length) return;
    if (!USE_MOCK_DATA && supabase) {
      const results = await Promise.all(
        updates.map((u) =>
          supabase!.from("influencer_profiles").update({ league_rank: u.rank }).eq("id", u.id),
        ),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      return;
    }
    for (const u of updates) {
      const inf = mockDB.influencer_profiles.find((i) => i.id === u.id);
      if (inf) inf.league_rank = u.rank;
    }
    save();
  },
  async setVisible(influencerId: string, visible: boolean) {
    if (!USE_MOCK_DATA && supabase) {
      const { error } = await supabase
        .from("influencer_profiles")
        .update({ is_visible: visible })
        .eq("id", influencerId);
      if (error) throw new Error(error.message);
      return;
    }
    const inf = mockDB.influencer_profiles.find((i) => i.id === influencerId);
    if (inf) inf.is_visible = visible;
    save();
  },
  // Mock-only: wipes the in-memory DB back to its seed. In live mode there is
  // deliberately no equivalent — the UI hides the action (see GodMode.tsx).
  async reset(): Promise<void> {
    if (!USE_MOCK_DATA) throw new Error("Reset is mock-only");
    resetMockDB();
  },
};
