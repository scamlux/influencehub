import type {
  AdType,
  AdvertisingPrice,
  AnalyticsHistory,
  Bid,
  BrandProfile,
  Campaign,
  CampaignStatus,
  Category,
  Deal,
  DealStatus,
  Discount,
  Favorite,
  InfluencerContact,
  InfluencerProfile,
  Message,
  Notification,
  Payment,
  Platform,
  Profile,
  ScrapingQueueItem,
  SocialPlatform,
  Subscription,
  UserRoleRow,
  AdminAction,
} from "@/types";

// ─── deterministic PRNG so seed data is stable across reloads ──────────────────
let seed = 1337;
function rng(): number {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}
function rint(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString();
}

const CITIES = ["Toshkent", "Samarqand", "Buxoro", "Andijon", "Namangan"];
const CATEGORIES: Category[] = [
  "food",
  "tech",
  "fashion",
  "lifestyle",
  "education",
  "travel",
  "beauty",
  "sports",
  "entertainment",
  "business",
  "auto",
];
const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "telegram"];
const AD_TYPES: AdType[] = ["post", "story", "video", "reel", "package", "native"];

const FIRST = [
  "Aziza",
  "Jasur",
  "Dilnoza",
  "Sardor",
  "Malika",
  "Bekzod",
  "Nodira",
  "Otabek",
  "Gulnora",
  "Rustam",
  "Madina",
  "Akmal",
  "Sevara",
  "Javohir",
  "Kamola",
  "Temur",
  "Nigora",
  "Shoxrux",
  "Zarina",
  "Bobur",
  "Feruza",
  "Doston",
  "Lola",
  "Ulugbek",
  "Marjona",
];
const LAST = [
  "Karimova",
  "Toshmatov",
  "Yusupova",
  "Rahimov",
  "Azizova",
  "Soliyev",
  "Umarova",
  "Qodirov",
  "Tursunova",
  "Ergashev",
  "Saidova",
  "Nazarov",
  "Ismoilova",
  "Komilov",
  "Yo‘ldosheva",
  "Hakimov",
  "Olimova",
  "Sobirov",
  "Mirzaeva",
  "Aliyev",
  "Hamidova",
  "Davronov",
  "Sultonova",
  "Botirov",
  "Niyozova",
];

export interface MockDB {
  profiles: Profile[];
  user_roles: UserRoleRow[];
  brand_profiles: BrandProfile[];
  influencer_profiles: InfluencerProfile[];
  social_platforms: SocialPlatform[];
  advertising_prices: AdvertisingPrice[];
  influencer_contacts: InfluencerContact[];
  discounts: Discount[];
  subscriptions: Subscription[];
  campaigns: Campaign[];
  bids: Bid[];
  deals: Deal[];
  messages: Message[];
  notifications: Notification[];
  favorites: Favorite[];
  analytics_history: AnalyticsHistory[];
  payments: Payment[];
  admin_actions: AdminAction[];
  scraping_queue: ScrapingQueueItem[];
}

let idCounter = 0;
const id = (prefix: string) => `${prefix}-${(++idCounter).toString().padStart(4, "0")}`;

function build(): MockDB {
  idCounter = 0;
  seed = 1337;

  const profiles: Profile[] = [];
  const user_roles: UserRoleRow[] = [];
  const brand_profiles: BrandProfile[] = [];
  const influencer_profiles: InfluencerProfile[] = [];
  const social_platforms: SocialPlatform[] = [];
  const advertising_prices: AdvertisingPrice[] = [];
  const influencer_contacts: InfluencerContact[] = [];
  const discounts: Discount[] = [];
  const subscriptions: Subscription[] = [];
  const campaigns: Campaign[] = [];
  const bids: Bid[] = [];
  const deals: Deal[] = [];
  const messages: Message[] = [];
  const notifications: Notification[] = [];
  const favorites: Favorite[] = [];
  const analytics_history: AnalyticsHistory[] = [];
  const payments: Payment[] = [];
  const admin_actions: AdminAction[] = [];
  const scraping_queue: ScrapingQueueItem[] = [];

  // ── 3 admins ──
  for (let i = 0; i < 3; i++) {
    const uidv = id("admin");
    profiles.push({
      id: uidv,
      full_name: `${pick(FIRST)} (Admin ${i + 1})`,
      email: i === 0 ? "admin@influencehub.uz" : `admin${i + 1}@influencehub.uz`,
      is_active: true,
      created_at: daysAgo(200),
    });
    user_roles.push({ id: id("role"), user_id: uidv, role: "admin", created_at: daysAgo(200) });
  }

  // ── 5 brands ──
  const brandIds: string[] = [];
  const brandUserIds: string[] = [];
  const brandNames = ["Artel", "Korzinka", "Uzum Market", "Beeline UZ", "Humans"];
  for (let i = 0; i < 5; i++) {
    const uidv = id("brand-user");
    brandUserIds.push(uidv);
    profiles.push({
      id: uidv,
      full_name: brandNames[i],
      email: i === 0 ? "brand@influencehub.uz" : `brand${i + 1}@influencehub.uz`,
      is_active: true,
      created_at: daysAgo(150 - i * 10),
    });
    user_roles.push({ id: id("role"), user_id: uidv, role: "brand", created_at: daysAgo(150) });
    const bp: BrandProfile = { id: id("bp"), user_id: uidv, created_at: daysAgo(150) };
    brand_profiles.push(bp);
    brandIds.push(bp.id);
  }
  // brand #1 gets an active brand_pro subscription
  subscriptions.push({
    id: id("sub"),
    user_id: brandUserIds[0],
    plan_type: "brand_pro",
    status: "active",
    expires_at: daysAgo(-25),
    stripe_subscription_id: "sub_mock_brandpro",
    created_at: daysAgo(5),
  });
  payments.push({
    id: id("pay"),
    user_id: brandUserIds[0],
    stripe_session_id: "cs_mock_1",
    plan_type: "brand_pro",
    amount: 29,
    currency: "USD",
    status: "succeeded",
    created_at: daysAgo(5),
  });

  // ── 25 influencers ──
  const influencerIds: string[] = [];
  const influencerUserIds: string[] = [];
  for (let i = 0; i < 25; i++) {
    const uidv = id("inf-user");
    influencerUserIds.push(uidv);
    const name = `${FIRST[i]} ${LAST[i]}`;
    profiles.push({
      id: uidv,
      full_name: name,
      email: i === 0 ? "influencer@influencehub.uz" : `inf${i + 1}@influencehub.uz`,
      is_active: true,
      created_at: daysAgo(180 - i * 4),
    });
    user_roles.push({
      id: id("role"),
      user_id: uidv,
      role: "influencer",
      created_at: daysAgo(180),
    });

    const category = CATEGORIES[i % CATEGORIES.length];
    const er = +(rng() * 8 + 1.5).toFixed(2);
    const inf: InfluencerProfile = {
      id: id("inf"),
      user_id: uidv,
      display_name: name,
      bio: `${category.charAt(0).toUpperCase() + category.slice(1)} creator from ${CITIES[i % CITIES.length]}. Collaborations open for authentic brands.`,
      category,
      city: CITIES[i % CITIES.length],
      is_visible: true,
      league_rank: i + 1,
      // No placeholder faces: demo bloggers have no real social photo, so they
      // fall back to initials rather than showing a stranger's face.
      avatar_url: null,
      onboarding_status: "completed",
      collection_error: null,
      engagement_rate: er,
      created_at: daysAgo(180 - i * 4),
    };
    influencer_profiles.push(inf);
    influencerIds.push(inf.id);

    // 1-3 platforms
    const nPlat = rint(1, 3);
    const chosen = [...PLATFORMS].sort(() => rng() - 0.5).slice(0, nPlat);
    chosen.forEach((plat, idx) => {
      const followers = rint(50_000, 15_000_000);
      const platER = +(rng() * 8 + 1.5).toFixed(2);
      social_platforms.push({
        id: id("plat"),
        influencer_id: inf.id,
        platform: plat,
        username: `${name.split(" ")[0].toLowerCase()}_${plat}`,
        followers_count: followers,
        engagement_rate: platER,
        profile_url: `https://${plat}.com/${name.split(" ")[0].toLowerCase()}`,
        is_primary: idx === 0,
        created_at: daysAgo(180 - i * 4),
      });

      // 30 days analytics per platform — a visible upward growth curve
      // start 10-20% below today's count and climb toward it day by day
      const startFollowers = Math.floor(followers * (0.8 + rng() * 0.1));
      const totalGrowth = followers - startFollowers;
      for (let d = 30; d >= 0; d--) {
        const progress = (30 - d) / 30;
        const noise = (rng() - 0.5) * totalGrowth * 0.04;
        const value = Math.round(startFollowers + totalGrowth * progress + noise);
        analytics_history.push({
          id: id("anl"),
          influencer_id: inf.id,
          platform: plat,
          followers_count: Math.max(0, Math.min(value, followers)),
          engagement_rate: +(platER + (rng() - 0.5)).toFixed(2),
          recorded_at: daysAgo(d),
        });
      }
    });

    // 2-5 prices
    const nPrices = rint(2, 5);
    const usedTypes = [...AD_TYPES].sort(() => rng() - 0.5).slice(0, nPrices);
    usedTypes.forEach((t) => {
      advertising_prices.push({
        id: id("price"),
        influencer_id: inf.id,
        ad_type: t,
        price_usd: rint(50, 5000),
        description: `${t} placement with full creative freedom`,
        duration: pick(["24h", "48h", "permanent"]),
        delivery_days: rint(2, 14),
        is_public: rng() > 0.4,
        created_at: daysAgo(60),
      });
    });

    // contact
    influencer_contacts.push({
      id: id("contact"),
      influencer_id: inf.id,
      email: `${name.split(" ")[0].toLowerCase()}@mail.uz`,
      phone: `+998 9${rint(0, 9)} ${rint(100, 999)} ${rint(10, 99)} ${rint(10, 99)}`,
      telegram_username: `@${name.split(" ")[0].toLowerCase()}`,
      instagram_dm: `@${name.split(" ")[0].toLowerCase()}_official`,
      created_at: daysAgo(60),
    });

    // some discounts
    if (rng() > 0.5) {
      discounts.push({
        id: id("disc"),
        influencer_id: inf.id,
        title: pick(["Summer Special", "First Deal Offer", "Bundle Deal", "Ramadan Promo"]),
        description: "Limited-time discount for new brand partners.",
        discount_percent: pick([10, 15, 20, 25, 30]),
        valid_until: daysAgo(-rint(5, 40)),
        is_active: true,
        created_at: daysAgo(20),
      });
    }
  }

  // top 3 influencers featured via influencer_feature subscription
  for (let i = 0; i < 3; i++) {
    subscriptions.push({
      id: id("sub"),
      user_id: influencerUserIds[i],
      plan_type: i === 0 ? "influencer_feature" : "influencer_sync",
      status: "active",
      expires_at: i === 0 ? daysAgo(-1) : daysAgo(-25),
      stripe_subscription_id: `sub_mock_inf_${i}`,
      created_at: daysAgo(3),
    });
  }

  // ── 10 campaigns ──
  const campaignStatuses: CampaignStatus[] = [
    "open",
    "open",
    "open",
    "active",
    "active",
    "completed",
    "draft",
    "open",
    "cancelled",
    "open",
  ];
  const campTitles = [
    "Summer Collection Launch",
    "New App Promo",
    "Ramadan Campaign",
    "Tech Gadget Review",
    "Fashion Week Coverage",
    "Food Delivery Push",
    "Back to School",
    "Fitness Challenge",
    "Travel Vlog Series",
    "Beauty Product Haul",
  ];
  const campDescriptions = [
    "Unveil our new summer line with vibrant lifestyle content shot outdoors. We want reels and stories that capture the season's energy.",
    "Drive installs for our redesigned app. Show your audience the onboarding flow and highlight the time-saving features in a short tutorial.",
    "A heartfelt Ramadan campaign focused on family, generosity and togetherness. Authentic storytelling around iftar moments preferred.",
    "Hands-on review of our flagship gadget. We need an honest unboxing plus a 60-second feature walkthrough for tech-savvy followers.",
    "Cover Tashkent Fashion Week from the front row. Behind-the-scenes stories, outfit breakdowns and designer interviews welcome.",
    "Promote 30-minute delivery in your city. A fun day-in-the-life clip ordering your favourite meal works great here.",
    "Back-to-school essentials for students and parents. Showcase our bundles with a practical haul and quick organisation tips.",
    "Join our 7-day fitness challenge and document your progress. Daily stories plus a recap reel that motivates your community.",
    "A multi-part travel vlog across Uzbekistan's silk-road cities. We're after cinematic footage and genuine local recommendations.",
    "Beauty haul featuring our new skincare range. Demonstrate the routine on camera and share honest before/after impressions.",
  ];
  for (let i = 0; i < 10; i++) {
    campaigns.push({
      id: id("camp"),
      brand_id: brandIds[i % brandIds.length],
      title: campTitles[i],
      description: campDescriptions[i],
      requirements: "Min 100K followers, 3%+ engagement, content in Uzbek or Russian.",
      budget_usd: rint(500, 10000),
      platform: pick(PLATFORMS),
      category: pick(CATEGORIES),
      status: campaignStatuses[i],
      deadline: daysAgo(-rint(7, 45)),
      created_at: daysAgo(rint(5, 60)),
    });
  }

  // ── 30 bids ──
  const openOrActive = campaigns.filter((c) => ["open", "active", "completed"].includes(c.status));
  for (let i = 0; i < 30; i++) {
    const camp = pick(openOrActive);
    const infId = pick(influencerIds);
    bids.push({
      id: id("bid"),
      campaign_id: camp.id,
      influencer_id: infId,
      proposed_price: rint(200, 6000),
      proposal: "I'd love to partner on this — here's how I'd bring your brand to my audience...",
      delivery_days: rint(3, 14),
      status: pick<Bid["status"]>(["pending", "pending", "accepted", "rejected"]),
      created_at: daysAgo(rint(1, 30)),
    });
  }
  // ensure influencer #1 has bids on open campaigns
  const openCamps = campaigns.filter((c) => c.status === "open");
  openCamps.slice(0, 3).forEach((c) => {
    bids.push({
      id: id("bid"),
      campaign_id: c.id,
      influencer_id: influencerIds[0],
      proposed_price: rint(500, 3000),
      proposal: "Excited about this campaign — my audience is a perfect match.",
      delivery_days: 7,
      status: "pending",
      created_at: daysAgo(2),
    });
  });

  // ── 10 deals ──
  const dealStatuses: DealStatus[] = [
    "active",
    "active",
    "content_submitted",
    "content_submitted",
    "approved",
    "completed",
    "completed",
    "active",
    "cancelled",
    "content_submitted",
  ];
  for (let i = 0; i < 10; i++) {
    const camp = pick(campaigns);
    const infId = i === 0 ? influencerIds[0] : pick(influencerIds);
    const brandId = i === 0 ? brandIds[0] : camp.brand_id;
    const status = dealStatuses[i];
    const dealId = id("deal");
    deals.push({
      id: dealId,
      bid_id: id("bid-ref"),
      campaign_id: camp.id,
      brand_id: brandId,
      influencer_id: infId,
      agreed_price: rint(300, 5000),
      status,
      content_url:
        status === "content_submitted" || status === "approved" || status === "completed"
          ? "https://instagram.com/p/mock-content"
          : null,
      completed_at: status === "completed" ? daysAgo(rint(1, 10)) : null,
      review: status === "completed" ? "Great collaboration, delivered on time!" : null,
      rating: status === "completed" ? rint(4, 5) : null,
      created_at: daysAgo(rint(2, 40)),
    });

    // a few messages per deal
    const brandUser = brandUserIds[brandIds.indexOf(brandId)] ?? brandUserIds[0];
    const infUser = influencerUserIds[influencerIds.indexOf(infId)] ?? influencerUserIds[0];
    const convo = [
      [brandUser, "Hi! Excited to work together on this campaign."],
      [infUser, "Thanks! When would you like the content to go live?"],
      [brandUser, "Ideally next week. Does that work for you?"],
    ];
    convo.forEach(([sender, content], mi) => {
      messages.push({
        id: id("msg"),
        deal_id: dealId,
        sender_id: sender,
        content,
        created_at: daysAgo(rint(1, 15) - mi * 0.1),
      });
    });
  }

  // ── favorites for brand #1 ──
  influencerIds.slice(0, 4).forEach((infId) => {
    favorites.push({
      id: id("fav"),
      user_id: brandUserIds[0],
      influencer_id: infId,
      created_at: daysAgo(rint(1, 20)),
    });
  });

  // ── notifications for brand #1 & influencer #1 ──
  notifications.push(
    {
      id: id("notif"),
      user_id: brandUserIds[0],
      type: "bid_received",
      title: "New bid received",
      message: "Aziza Karimova submitted a bid on Summer Collection Launch.",
      link: "/brand/campaigns",
      is_read: false,
      created_at: daysAgo(0.2),
    },
    {
      id: id("notif"),
      user_id: brandUserIds[0],
      type: "deal_update",
      title: "Content submitted",
      message: "A creator submitted content for your review.",
      link: "/brand/deals",
      is_read: false,
      created_at: daysAgo(1),
    },
    {
      id: id("notif"),
      user_id: influencerUserIds[0],
      type: "bid_accepted",
      title: "Your bid was accepted!",
      message: "Korzinka accepted your bid. A new deal has been created.",
      link: "/influencer/deals",
      is_read: false,
      created_at: daysAgo(0.5),
    },
  );

  // ── scraping queue ──
  const scrapeStatuses: ScrapingQueueItem["status"][] = [
    "completed",
    "completed",
    "processing",
    "pending",
    "failed",
    "pending",
    "completed",
  ];
  scrapeStatuses.forEach((st, i) => {
    scraping_queue.push({
      id: id("scrape"),
      influencer_id: influencerIds[i],
      status: st,
      error: st === "failed" ? "Instagram rate limit exceeded" : null,
      created_at: daysAgo(rint(0, 3)),
    });
  });

  // ── admin actions audit log ──
  for (let i = 0; i < 8; i++) {
    admin_actions.push({
      id: id("audit"),
      admin_id: profiles[0].id,
      action_type: pick(["approve_influencer", "update_rank", "deactivate_user", "refresh_stats"]),
      target_table: pick(["influencer_profiles", "profiles", "scraping_queue"]),
      target_id: pick(influencerIds),
      details: { note: "Action performed via admin panel" },
      created_at: daysAgo(rint(1, 30)),
    });
  }

  return {
    profiles,
    user_roles,
    brand_profiles,
    influencer_profiles,
    social_platforms,
    advertising_prices,
    influencer_contacts,
    discounts,
    subscriptions,
    campaigns,
    bids,
    deals,
    messages,
    notifications,
    favorites,
    analytics_history,
    payments,
    admin_actions,
    scraping_queue,
  };
}

// Single in-memory instance, persisted to localStorage so edits survive reloads.
// Bumped to v2 so the improved seed data (varied campaign descriptions,
// realistic follower-growth curves) replaces any stale cached copy.
const STORAGE_KEY = "influencehub_mockdb_v2";

function load(): MockDB {
  if (typeof localStorage !== "undefined") {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as MockDB;
      } catch {
        /* fall through to rebuild */
      }
    }
  }
  const fresh = build();
  persist(fresh);
  return fresh;
}

export function persist(db: MockDB) {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }
}

export function resetMockDB(): MockDB {
  const fresh = build();
  persist(fresh);
  Object.assign(mockDB, fresh);
  return mockDB;
}

export const mockDB: MockDB = load();
