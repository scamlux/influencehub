import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { RoleGuard } from "./components/RoleGuard";
import { GuestOnly } from "./components/GuestOnly";
import { RouteTitle } from "./components/RouteTitle";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { PageLoader } from "./components/common";

// Layouts are needed for the very first paint of each section, so keep them eager.
import { BrandLayout } from "./components/layout/BrandLayout";
import { InfluencerLayout } from "./components/layout/InfluencerLayout";
import { AdminLayout } from "./components/layout/AdminLayout";

// ── Code-split every page so each route ships its own chunk ────────────────────
// public
const Home = lazy(() => import("./pages/public/Home"));
const PublicLeague = lazy(() => import("./pages/public/League"));
const Pricing = lazy(() => import("./pages/public/Pricing"));
const BloggerProfilePublic = lazy(() => import("./pages/public/BloggerProfile"));
const Login = lazy(() => import("./pages/public/Login"));
const Register = lazy(() => import("./pages/public/Register"));
const ForgotPassword = lazy(() => import("./pages/public/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/public/ResetPassword"));
const ChooseRole = lazy(() => import("./pages/public/ChooseRole"));
const AuthCallback = lazy(() => import("./pages/public/AuthCallback"));
const Forbidden = lazy(() => import("./pages/public/Forbidden"));
const Terms = lazy(() => import("./pages/public/Terms"));
const Privacy = lazy(() => import("./pages/public/Privacy"));
const NotFound = lazy(() => import("./pages/public/NotFound"));

// brand
const BrandDashboard = lazy(() => import("./pages/brand/Dashboard"));
const BrandLeague = lazy(() => import("./pages/brand/League"));
const BrandBloggerProfile = lazy(() => import("./pages/brand/BloggerProfile"));
const BrandCampaigns = lazy(() => import("./pages/brand/Campaigns"));
const BrandCampaignDetail = lazy(() => import("./pages/brand/CampaignDetail"));
const BrandNewCampaign = lazy(() => import("./pages/brand/NewCampaign"));
const BrandDeals = lazy(() => import("./pages/brand/Deals"));
const BrandChat = lazy(() => import("./pages/brand/Chat"));
const BrandCompare = lazy(() => import("./pages/brand/Compare"));
const BrandFavorites = lazy(() => import("./pages/brand/Favorites"));
const BrandSettings = lazy(() => import("./pages/brand/Settings"));
const BrandSubscription = lazy(() => import("./pages/brand/Subscription"));

// influencer
const InfDashboard = lazy(() => import("./pages/influencer/Dashboard"));
const InfProfile = lazy(() => import("./pages/influencer/Profile"));
const InfOnboard = lazy(() => import("./pages/influencer/Onboard"));
const InfPricing = lazy(() => import("./pages/influencer/Pricing"));
const InfDiscounts = lazy(() => import("./pages/influencer/Discounts"));
const InfBids = lazy(() => import("./pages/influencer/Bids"));
const InfDeals = lazy(() => import("./pages/influencer/Deals"));
const InfChat = lazy(() => import("./pages/influencer/Chat"));
const InfCampaigns = lazy(() => import("./pages/influencer/Campaigns"));

// admin
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminBloggers = lazy(() => import("./pages/admin/Bloggers"));
const AdminCampaigns = lazy(() => import("./pages/admin/Campaigns"));
const AdminDeals = lazy(() => import("./pages/admin/Deals"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminPayments = lazy(() => import("./pages/admin/Payments"));
const AdminAuditLog = lazy(() => import("./pages/admin/AuditLog"));
const AdminScrapingQueue = lazy(() => import("./pages/admin/ScrapingQueue"));
const AdminGodMode = lazy(() => import("./pages/admin/GodMode"));
const AdminSubscriptions = lazy(() => import("./pages/admin/Subscriptions"));

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <AnimatedBackground />
        <RouteTitle />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Home />} />
          <Route path="/league" element={<PublicLeague />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/blogger/:id" element={<BloggerProfilePublic />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
          <Route
            path="/register"
            element={
              <GuestOnly>
                <Register />
              </GuestOnly>
            }
          />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/choose-role" element={<ChooseRole />} />
          <Route path="/forbidden" element={<Forbidden />} />

          {/* Brand */}
          <Route
            path="/brand"
            element={
              <RoleGuard role="brand">
                <BrandLayout />
              </RoleGuard>
            }
          >
            <Route index element={<Navigate to="/brand/dashboard" replace />} />
            <Route path="dashboard" element={<BrandDashboard />} />
            <Route path="league" element={<BrandLeague />} />
            <Route path="bloggers/:id" element={<BrandBloggerProfile />} />
            <Route path="campaigns" element={<BrandCampaigns />} />
            <Route path="campaigns/new" element={<BrandNewCampaign />} />
            <Route path="campaigns/:id" element={<BrandCampaignDetail />} />
            <Route path="deals" element={<BrandDeals />} />
            <Route path="chat/:dealId" element={<BrandChat />} />
            <Route path="compare" element={<BrandCompare />} />
            <Route path="favorites" element={<BrandFavorites />} />
            <Route path="settings" element={<BrandSettings />} />
            <Route path="subscription" element={<BrandSubscription />} />
          </Route>

          {/* Influencer */}
          <Route
            path="/influencer"
            element={
              <RoleGuard role="influencer">
                <InfluencerLayout />
              </RoleGuard>
            }
          >
            <Route index element={<Navigate to="/influencer/dashboard" replace />} />
            <Route path="dashboard" element={<InfDashboard />} />
            <Route path="profile" element={<InfProfile />} />
            <Route path="onboard" element={<InfOnboard />} />
            <Route path="pricing" element={<InfPricing />} />
            <Route path="discounts" element={<InfDiscounts />} />
            <Route path="bids" element={<InfBids />} />
            <Route path="deals" element={<InfDeals />} />
            <Route path="chat/:dealId" element={<InfChat />} />
            <Route path="campaigns" element={<InfCampaigns />} />
          </Route>

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <RoleGuard role="admin">
                <AdminLayout />
              </RoleGuard>
            }
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="bloggers" element={<AdminBloggers />} />
            <Route path="campaigns" element={<AdminCampaigns />} />
            <Route path="deals" element={<AdminDeals />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="subscriptions" element={<AdminSubscriptions />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="audit-log" element={<AdminAuditLog />} />
            <Route path="scraping-queue" element={<AdminScrapingQueue />} />
            <Route path="god-mode" element={<AdminGodMode />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
