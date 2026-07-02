// ─── Enums / unions ──────────────────────────────────────────────────────────
export type UserRole = "brand" | "influencer" | "admin";

export type Category =
  | "food"
  | "tech"
  | "fashion"
  | "lifestyle"
  | "education"
  | "travel"
  | "beauty"
  | "sports"
  | "entertainment"
  | "business"
  | "auto";

export type Platform = "youtube" | "instagram" | "tiktok" | "telegram";

export type AdType = "post" | "story" | "video" | "reel" | "package" | "native";

export type OnboardingStatus = "pending" | "processing" | "completed" | "failed";

export type PlanType = "brand_pro" | "influencer_sync" | "influencer_feature";

export type SubscriptionStatus = "active" | "cancelled" | "expired";

export type CampaignStatus = "draft" | "open" | "active" | "completed" | "cancelled";

export type BidStatus = "pending" | "accepted" | "rejected";

export type DealStatus =
  // marketplace flow
  | "active"
  | "content_submitted"
  | "approved"
  | "completed"
  | "cancelled"
  // escrow flow (T-13)
  | "funded"
  | "in_progress"
  | "delivered"
  | "released"
  | "disputed";

export type ScrapingStatus = "pending" | "processing" | "completed" | "failed";

// ─── Tables ──────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface BrandProfile {
  id: string;
  user_id: string;
  created_at: string;
}

export interface InfluencerProfile {
  id: string;
  user_id: string | null;
  display_name: string;
  bio: string | null;
  category: Category;
  city: string | null;
  country?: string | null; // ISO code, e.g. 'UZ'
  is_visible: boolean;
  league_rank: number | null;
  avatar_url: string | null;
  onboarding_status: OnboardingStatus;
  collection_error: string | null;
  engagement_rate: number | null;
  created_at: string;
}

export interface SocialPlatform {
  id: string;
  influencer_id: string;
  platform: Platform;
  username: string;
  followers_count: number;
  engagement_rate: number | null;
  profile_url: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface AdvertisingPrice {
  id: string;
  influencer_id: string;
  ad_type: AdType;
  price_usd: number;
  description: string | null;
  duration: string | null;
  delivery_days: number;
  is_public: boolean;
  created_at: string;
}

export interface InfluencerContact {
  id: string;
  influencer_id: string;
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
  instagram_dm: string | null;
  created_at: string;
}

export interface Discount {
  id: string;
  influencer_id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: PlanType;
  status: SubscriptionStatus;
  expires_at: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

export interface Campaign {
  id: string;
  brand_id: string;
  title: string;
  description: string | null;
  requirements: string | null;
  budget_usd: number;
  platform: Platform;
  category: Category | null;
  status: CampaignStatus;
  deadline: string | null;
  created_at: string;
}

export interface Bid {
  id: string;
  campaign_id: string;
  influencer_id: string;
  proposed_price: number;
  proposal: string | null;
  delivery_days: number;
  status: BidStatus;
  created_at: string;
}

export interface Deal {
  id: string;
  bid_id: string;
  campaign_id: string;
  brand_id: string;
  influencer_id: string;
  agreed_price: number;
  status: DealStatus;
  content_url: string | null;
  completed_at: string | null;
  review: string | null;
  rating: number | null;
  created_at: string;
}

export interface Message {
  id: string;
  deal_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Favorite {
  id: string;
  user_id: string;
  influencer_id: string;
  created_at: string;
}

export interface AnalyticsHistory {
  id: string;
  influencer_id: string;
  platform: Platform;
  followers_count: number;
  engagement_rate: number | null;
  recorded_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  stripe_session_id: string | null;
  plan_type: PlanType;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: string;
  target_table: string;
  target_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ScrapingQueueItem {
  id: string;
  influencer_id: string;
  status: ScrapingStatus;
  error: string | null;
  created_at: string;
}

// ─── Composite / view models ───────────────────────────────────────────────────
export interface InfluencerFull extends InfluencerProfile {
  platforms: SocialPlatform[];
  prices: AdvertisingPrice[];
  contact: InfluencerContact | null;
  discounts: Discount[];
  total_followers: number;
  is_featured: boolean;
  last_synced: string;
}

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole | null;
  is_active: boolean;
}
