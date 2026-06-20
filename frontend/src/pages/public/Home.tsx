import { Link } from "react-router-dom";
import {
  ArrowRight,
  Trophy,
  Target,
  KeyRound,
  BadgeCheck,
  Search,
  Handshake,
  TrendingUp,
  Check,
  X,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfluencerCard } from "@/components/league/InfluencerCard";
import { PageLoader } from "@/components/common";
import { useInfluencers } from "@/hooks/useInfluencers";
import { useLanguage } from "@/hooks/useLanguage";

export default function Home() {
  const { t } = useLanguage();
  const { data, loading } = useInfluencers();
  const top = data.slice(0, 4);

  const features = [
    {
      icon: Trophy,
      title: t("home.feature.rankings.title"),
      desc: t("home.feature.rankings.desc"),
    },
    {
      icon: Target,
      title: t("home.feature.matching.title"),
      desc: t("home.feature.matching.desc"),
    },
    { icon: KeyRound, title: t("home.feature.access.title"), desc: t("home.feature.access.desc") },
    { icon: BadgeCheck, title: t("profile.verified"), desc: t("home.feature.verified.desc") },
  ];

  const steps = [
    {
      icon: Search,
      title: "Browse the League",
      desc: "Explore ranked creators by reach, niche & city.",
    },
    {
      icon: Target,
      title: "Compare & Shortlist",
      desc: "Stack creators side by side and save favorites.",
    },
    {
      icon: Handshake,
      title: "Launch a Campaign",
      desc: "Post a brief and collect bids from creators.",
    },
    {
      icon: TrendingUp,
      title: "Close the Deal",
      desc: "Chat, approve content, and track delivery.",
    },
  ];

  const comparison = [
    ["Verified follower data", false, true],
    ["Transparent pricing", false, true],
    ["Direct contact details", false, true],
    ["Side-by-side comparison", false, true],
    ["Exclusive discounts", false, true],
  ] as const;

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden border-b dark:bg-gradient-to-br dark:from-[#0d0d1a] dark:via-[#0f0a1e] dark:to-[#0d0d1a]">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="container py-16 text-center sm:py-20 md:py-28">
          <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm dark:bg-white/10 dark:border-white/20 dark:text-white">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            Central Asia's #1 influencer marketplace
          </div>
          <h1 className="mx-auto max-w-3xl animate-slide-up text-4xl font-bold tracking-tight sm:text-6xl">
            {t("hero.titleLead")}{" "}
            <span className="bg-gradient-to-r from-pink-500 via-pink-400 to-purple-500 bg-clip-text text-transparent">
              {t("hero.titleHighlight")}
            </span>
          </h1>
          <p
            className="mx-auto mt-5 max-w-xl animate-slide-up text-lg text-muted-foreground"
            style={{ animationDelay: "0.1s" }}
          >
            {t("hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/league">
                {t("hero.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full sm:w-auto dark:border-white/30 dark:text-white dark:hover:bg-white/10"
            >
              <Link to="/register">{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>

          {/* Stats bar */}
          <div className="mt-10 flex items-center justify-center gap-5 text-sm text-muted-foreground sm:gap-8">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground dark:text-white">
                {data.length || 26}+
              </span>
              <span>{t("home.stats.creators")}</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground dark:text-white">$100K+</span>
              <span>{t("home.stats.deals")}</span>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="flex flex-col items-center">
              <span className="text-2xl font-bold text-foreground dark:text-white">3</span>
              <span>{t("home.stats.countries")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section separator */}
      <div className="h-px dark:bg-gradient-to-r dark:from-transparent dark:via-pink-500/20 dark:to-transparent" />

      {/* Features */}
      <section className="bg-secondary/20 py-20 dark:bg-gradient-to-b dark:from-transparent dark:via-white/[0.02] dark:to-transparent">
        <div className="container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="animate-fade-scale rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/0 p-[1px]"
                style={{ animationDelay: `${(i + 1) * 0.1}s` }}
              >
                <div className="group relative h-full cursor-pointer overflow-hidden rounded-xl bg-card p-6 shadow-md transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-pink-500/10 dark:bg-[#0f1020] dark:border dark:border-[#1e2035] dark:shadow-xl dark:shadow-black/40 dark:hover:border-pink-500/30 dark:hover:shadow-pink-500/10">
                  <span className="absolute right-4 top-4 bg-gradient-to-br from-pink-500/30 to-transparent bg-clip-text text-4xl font-black text-transparent">
                    {i + 1}
                  </span>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 shadow-lg shadow-pink-500/20">
                    <f.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section separator */}
      <div className="h-px dark:bg-gradient-to-r dark:from-transparent dark:via-pink-500/20 dark:to-transparent" />

      {/* Top bloggers */}
      <section className="border-y bg-secondary/30 py-20">
        <div className="container">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold md:text-4xl dark:[text-shadow:0_0_30px_rgba(255,40,130,0.2)]">
              {t("home.top.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("home.top.subtitle")}</p>
          </div>
          {loading ? (
            <PageLoader />
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {top.map((inf, i) => (
                <div
                  key={inf.id}
                  className="animate-fade-scale"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <InfluencerCard influencer={inf} profileLink={`/blogger/${inf.id}`} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <Button asChild variant="outline" size="lg">
              <Link to="/league">
                {t("home.top.viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Section separator */}
      <div className="h-px dark:bg-gradient-to-r dark:from-transparent dark:via-pink-500/20 dark:to-transparent" />

      {/* How it works */}
      <section className="py-20 dark:bg-white/[0.01]">
        <div className="container">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold md:text-4xl dark:[text-shadow:0_0_30px_rgba(255,40,130,0.2)]">
              {t("home.how.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("home.how.subtitle")}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="relative rounded-xl border bg-card p-6 shadow-md dark:bg-[#0f1020] dark:border dark:border-[#1e2035] dark:shadow-xl dark:shadow-black/30"
              >
                <span className="absolute right-4 top-4 text-3xl font-bold text-primary/10 dark:text-white/20">
                  {i + 1}
                </span>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section separator */}
      <div className="h-px dark:bg-gradient-to-r dark:from-transparent dark:via-pink-500/20 dark:to-transparent" />

      {/* Comparison */}
      <section className="border-y bg-secondary/30 py-20 dark:bg-transparent">
        <div className="container max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold md:text-4xl dark:[text-shadow:0_0_30px_rgba(255,40,130,0.2)]">
              {t("home.compare.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("home.compare.subtitle")}</p>
          </div>
          <Card className="dark:border-border dark:bg-card">
            <div className="grid grid-cols-3 border-b p-4 text-sm font-semibold dark:bg-secondary dark:border-border dark:text-foreground">
              <span>{t("home.compare.feature")}</span>
              <span className="text-center text-muted-foreground">{t("home.compare.without")}</span>
              <span className="text-center text-primary">{t("home.compare.with")}</span>
            </div>
            {comparison.map(([label, without, withHub]) => (
              <div
                key={label}
                className="grid grid-cols-3 items-center border-b p-4 text-sm last:border-0 dark:border-border dark:text-foreground"
              >
                <span>{label}</span>
                <span className="flex justify-center">
                  {without ? (
                    <Check className="h-5 w-5 text-success-foreground" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground" />
                  )}
                </span>
                <span className="flex justify-center">
                  {withHub ? (
                    <Check className="h-5 w-5 text-success-foreground" />
                  ) : (
                    <X className="h-5 w-5 text-muted-foreground" />
                  )}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </section>

      {/* Section separator */}
      <div className="h-px dark:bg-gradient-to-r dark:from-transparent dark:via-pink-500/20 dark:to-transparent" />

      {/* Testimonials */}
      <section className="container py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold md:text-4xl dark:[text-shadow:0_0_30px_rgba(255,40,130,0.2)]">
            {t("home.testimonials.title")}
          </h2>
          <p className="mt-2 text-muted-foreground">{t("home.testimonials.subtitle")}</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {[
            {
              name: "Korzinka",
              role: "Brand",
              quote:
                "We found 3 perfect creators in a single afternoon. The league rankings are gold.",
            },
            {
              name: "Aziza K.",
              role: "Creator",
              quote: "InfluenceHub doubled my brand deals. Brands reach out directly now.",
            },
            {
              name: "Uzum Market",
              role: "Brand",
              quote: "Transparent pricing finally. No more endless DMs to get a rate card.",
            },
          ].map((tm) => (
            <Card
              key={tm.name}
              className="shadow-md dark:bg-[#0f1020] dark:border dark:border-[#1e2035] dark:border-l dark:border-l-pink-500/40 dark:shadow-lg"
            >
              <CardContent className="p-6">
                <p className="text-sm">“{tm.quote}”</p>
                <div className="mt-4">
                  <p className="font-semibold dark:text-foreground">{tm.name}</p>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    {tm.role}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="container pb-20">
        <div className="rounded-2xl gradient-primary p-12 text-center text-white">
          <h2 className="text-3xl font-bold md:text-4xl dark:[text-shadow:0_0_30px_rgba(255,40,130,0.2)]">
            {t("home.finalCta.title")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-white/90">{t("home.finalCta.subtitle")}</p>
          <Button
            asChild
            size="lg"
            className="mt-6 bg-white text-pink-600 hover:bg-white/90 font-semibold"
          >
            <Link to="/register">{t("nav.register")}</Link>
          </Button>
        </div>
      </section>
    </PublicLayout>
  );
}
