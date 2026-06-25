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
  Quote,
} from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InfluencerCard } from "@/components/league/InfluencerCard";
import { CardGridSkeleton } from "@/components/common";
import { Reveal, Stagger, StaggerItem, AnimatedCounter, motion } from "@/components/motion";
import { fadeInUp, scaleIn } from "@/lib/motion";
import { useInfluencers } from "@/hooks/useInfluencers";
import { useLanguage } from "@/hooks/useLanguage";

export default function Home() {
  const { t } = useLanguage();
  const { data, loading } = useInfluencers();
  const top = data.slice(0, 4);

  const features = [
    { icon: Trophy, title: t("home.feature.rankings.title"), desc: t("home.feature.rankings.desc") },
    { icon: Target, title: t("home.feature.matching.title"), desc: t("home.feature.matching.desc") },
    { icon: KeyRound, title: t("home.feature.access.title"), desc: t("home.feature.access.desc") },
    { icon: BadgeCheck, title: t("profile.verified"), desc: t("home.feature.verified.desc") },
  ];

  const steps = [
    { icon: Search, title: "Browse the League", desc: "Explore ranked creators by reach, niche & city." },
    { icon: Target, title: "Compare & Shortlist", desc: "Stack creators side by side and save favorites." },
    { icon: Handshake, title: "Launch a Campaign", desc: "Post a brief and collect bids from creators." },
    { icon: TrendingUp, title: "Close the Deal", desc: "Chat, approve content, and track delivery." },
  ];

  const comparison = [
    ["Verified follower data", false, true],
    ["Transparent pricing", false, true],
    ["Direct contact details", false, true],
    ["Side-by-side comparison", false, true],
    ["Exclusive discounts", false, true],
  ] as const;

  const stats = [
    { value: data.length || 26, format: (n: number) => `${Math.round(n)}+`, label: t("home.stats.creators") },
    { value: 100, format: (n: number) => `$${Math.round(n)}K+`, label: t("home.stats.deals") },
    { value: 3, format: (n: number) => `${Math.round(n)}`, label: t("home.stats.countries") },
  ];

  return (
    <PublicLayout>
      {/* ---- Hero ---------------------------------------------------------- */}
      <section className="relative overflow-hidden border-b">
        {/* Ambient brand mesh + grid texture (token-driven, masked) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_30%,transparent_75%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-10%] -z-10 h-[480px] w-[820px] max-w-[120vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.18),transparent_65%)] blur-2xl"
        />

        <div className="container py-20 text-center sm:py-24 md:py-32">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card/70 px-4 py-1.5 text-sm font-medium shadow-xs backdrop-blur"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Central Asia's #1 influencer marketplace
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.06 }}
            className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl"
          >
            {t("hero.titleLead")} <span className="text-gradient">{t("hero.titleHighlight")}</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.12 }}
            className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground"
          >
            {t("hero.subtitle")}
          </motion.p>

          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.18 }}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
          >
            <Button asChild size="lg" variant="gradient" className="w-full sm:w-auto">
              <Link to="/league">
                {t("hero.cta")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/register">{t("hero.ctaSecondary")}</Link>
            </Button>
          </motion.div>

          {/* Stats bar with animated counters */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="show"
            transition={{ delay: 0.26 }}
            className="mx-auto mt-12 flex max-w-xl items-center justify-center divide-x divide-border rounded-2xl border bg-card/60 py-5 shadow-sm backdrop-blur"
          >
            {stats.map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center px-3">
                <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                  <AnimatedCounter value={s.value} format={s.format} />
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{s.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---- Features ------------------------------------------------------ */}
      <section className="border-b bg-surface py-20 dark:bg-transparent">
        <div className="container">
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <StaggerItem key={f.title} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <span className="text-gradient absolute right-4 top-3 text-4xl font-black opacity-60">
                    {i + 1}
                  </span>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
                    <f.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---- Top bloggers -------------------------------------------------- */}
      <section className="border-b bg-secondary/30 py-20 dark:bg-transparent">
        <div className="container">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("home.top.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.top.subtitle")}</p>
          </Reveal>
          {loading ? (
            <CardGridSkeleton />
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {top.map((inf) => (
                <StaggerItem key={inf.id} className="h-full">
                  <InfluencerCard influencer={inf} profileLink={`/blogger/${inf.id}`} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
          <Reveal className="mt-10 text-center" delay={0.1}>
            <Button asChild variant="outline" size="lg">
              <Link to="/league">
                {t("home.top.viewAll")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ---- How it works -------------------------------------------------- */}
      <section className="border-b py-20">
        <div className="container">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("home.how.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.how.subtitle")}</p>
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <StaggerItem key={s.title} className="h-full">
                <div className="relative h-full rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <span className="absolute right-4 top-3 text-3xl font-bold text-primary/15">
                    {i + 1}
                  </span>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---- Comparison ---------------------------------------------------- */}
      <section className="border-b bg-secondary/30 py-20 dark:bg-transparent">
        <div className="container max-w-3xl">
          <Reveal className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("home.compare.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("home.compare.subtitle")}</p>
          </Reveal>
          <Reveal variants={scaleIn}>
            <Card className="overflow-hidden shadow-md">
              <div className="grid grid-cols-3 border-b bg-secondary/60 p-4 text-sm font-semibold">
                <span>{t("home.compare.feature")}</span>
                <span className="text-center text-muted-foreground">{t("home.compare.without")}</span>
                <span className="text-center text-primary">{t("home.compare.with")}</span>
              </div>
              {comparison.map(([label, without, withHub]) => (
                <div
                  key={label}
                  className="grid grid-cols-3 items-center border-b p-4 text-sm last:border-0"
                >
                  <span>{label}</span>
                  <span className="flex justify-center">
                    {without ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/60" />
                    )}
                  </span>
                  <span className="flex justify-center">
                    {withHub ? (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                        <Check className="h-4 w-4 text-primary" />
                      </span>
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/60" />
                    )}
                  </span>
                </div>
              ))}
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ---- Testimonials -------------------------------------------------- */}
      <section className="container border-b py-20">
        <Reveal className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("home.testimonials.title")}</h2>
          <p className="mt-2 text-muted-foreground">{t("home.testimonials.subtitle")}</p>
        </Reveal>
        <Stagger className="grid gap-6 sm:grid-cols-3">
          {[
            { name: "Korzinka", role: "Brand", quote: "We found 3 perfect creators in a single afternoon. The league rankings are gold." },
            { name: "Aziza K.", role: "Creator", quote: "InfluenceHub doubled my brand deals. Brands reach out directly now." },
            { name: "Uzum Market", role: "Brand", quote: "Transparent pricing finally. No more endless DMs to get a rate card." },
          ].map((tm) => (
            <StaggerItem key={tm.name} className="h-full">
              <Card className="relative h-full border-l-2 border-l-primary/50 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                <CardContent className="p-6">
                  <Quote className="h-6 w-6 text-primary/30" />
                  <p className="mt-3 text-sm leading-relaxed">{tm.quote}</p>
                  <div className="mt-4">
                    <p className="font-semibold">{tm.name}</p>
                    <p className="text-xs text-muted-foreground">{tm.role}</p>
                  </div>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* ---- Final CTA ----------------------------------------------------- */}
      <section className="container py-20">
        <Reveal variants={scaleIn}>
          <div className="relative overflow-hidden rounded-2xl gradient-primary p-10 text-center text-primary-foreground shadow-glow-lg sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]"
            />
            <div className="relative">
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">{t("home.finalCta.title")}</h2>
              <p className="mx-auto mt-3 max-w-lg text-primary-foreground/90">{t("home.finalCta.subtitle")}</p>
              <Button
                asChild
                size="lg"
                className="mt-7 bg-white font-semibold text-primary shadow-md hover:bg-white/90"
              >
                <Link to="/register">{t("nav.register")}</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </section>
    </PublicLayout>
  );
}
