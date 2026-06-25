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
import { Marquee } from "@/components/ui/marquee";
import { CardGridSkeleton } from "@/components/common";
import { Reveal, Stagger, StaggerItem, AnimatedCounter } from "@/components/motion";
import { scaleIn } from "@/lib/motion";
import { useInfluencers } from "@/hooks/useInfluencers";
import { useLanguage } from "@/hooks/useLanguage";

export default function Home() {
  const { t } = useLanguage();
  const { data, loading } = useInfluencers();
  // Showcase local creators first (this is a Central Asia / Uzbekistan
  // marketplace); fall back to the global top if there aren't enough.
  const uz = data.filter((i) => i.country === "UZ");
  const top = (uz.length >= 4 ? uz : data).slice(0, 4);

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

  const brands = [
    "Korzinka",
    "Uzum Market",
    "Uzcard",
    "Click",
    "Payme",
    "Humans",
    "Beeline",
    "Artel",
    "MyTaxi",
  ];

  const stats = [
    { value: data.length || 26, format: (n: number) => `${Math.round(n)}+`, label: t("home.stats.creators") },
    { value: 100, format: (n: number) => `$${Math.round(n)}K+`, label: t("home.stats.deals") },
    { value: 3, format: (n: number) => `${Math.round(n)}`, label: t("home.stats.countries") },
  ];

  return (
    <PublicLayout>
      {/* ---- Hero (rendered immediately — no opacity animation, protects LCP) ---- */}
      <section aria-labelledby="hero-heading" className="relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.5] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_30%,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-[-10%] -z-10 h-[480px] w-[820px] max-w-[120vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.18),transparent_65%)] blur-2xl"
        />

        <div className="container py-20 text-center sm:py-24 md:py-32">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card/70 px-4 py-1.5 text-sm font-medium shadow-xs backdrop-blur">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Central Asia's #1 influencer marketplace
          </div>

          <h1
            id="hero-heading"
            className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-6xl"
          >
            {t("hero.titleLead")} <span className="text-gradient">{t("hero.titleHighlight")}</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">{t("hero.subtitle")}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Button asChild size="lg" variant="gradient" className="w-full sm:w-auto">
              <Link to="/league">
                {t("hero.cta")} <ArrowRight className="h-4 w-4" aria-hidden="true" focusable="false" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/register">{t("hero.ctaSecondary")}</Link>
            </Button>
          </div>

          {/* Stats bar with animated counters */}
          <div className="mx-auto mt-12 flex max-w-xl items-center justify-center divide-x divide-border rounded-2xl border bg-card/60 py-5 shadow-sm backdrop-blur">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-1 flex-col items-center px-3">
                <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                  <AnimatedCounter value={s.value} format={s.format} />
                </span>
                <span className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Features ------------------------------------------------------ */}
      <section
        aria-labelledby="features-heading"
        className="border-b bg-surface py-20 dark:bg-transparent"
      >
        <div className="container">
          <h2 id="features-heading" className="sr-only">
            Why InfluenceHub
          </h2>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <StaggerItem key={f.title} className="h-full">
                <div className="group relative h-full overflow-hidden rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg">
                  <span aria-hidden="true" className="text-gradient absolute right-4 top-3 text-4xl font-black opacity-60">
                    {i + 1}
                  </span>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
                    <f.icon className="h-6 w-6" aria-hidden="true" focusable="false" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---- Trusted by (21st.dev marquee, adapted) ------------------------ */}
      <section aria-labelledby="trusted-heading" className="border-b py-12">
        <div className="container">
          <h2
            id="trusted-heading"
            className="mb-7 text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            Trusted by leading brands across Central Asia
          </h2>
          <Marquee speed="38s">
            {brands.map((b) => (
              <span
                key={b}
                className="shrink-0 select-none text-xl font-bold tracking-tight text-muted-foreground/60 transition-colors duration-300 hover:text-foreground sm:text-2xl"
              >
                {b}
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* ---- Top bloggers -------------------------------------------------- */}
      <section
        aria-labelledby="top-heading"
        className="border-b bg-secondary/30 py-20 dark:bg-transparent"
      >
        <div className="container">
          <Reveal className="mb-10 text-center">
            <h2 id="top-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
              {t("home.top.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("home.top.subtitle")}</p>
          </Reveal>
          {loading ? (
            <CardGridSkeleton />
          ) : (
            <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {top.map((inf, i) => (
                <StaggerItem key={inf.id} className="h-full">
                  <InfluencerCard influencer={inf} profileLink={`/blogger/${inf.id}`} priority={i === 0} />
                </StaggerItem>
              ))}
            </Stagger>
          )}
          <Reveal className="mt-10 text-center" delay={0.1}>
            <Button asChild variant="outline" size="lg">
              <Link to="/league">
                {t("home.top.viewAll")} <ArrowRight className="h-4 w-4" aria-hidden="true" focusable="false" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      {/* ---- How it works -------------------------------------------------- */}
      <section aria-labelledby="how-heading" className="border-b py-20">
        <div className="container">
          <Reveal className="mb-10 text-center">
            <h2 id="how-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
              {t("home.how.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("home.how.subtitle")}</p>
          </Reveal>
          <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <StaggerItem key={s.title} className="h-full">
                <div className="relative h-full rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
                  <span aria-hidden="true" className="absolute right-4 top-3 text-3xl font-bold text-primary/15">
                    {i + 1}
                  </span>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <s.icon className="h-6 w-6" aria-hidden="true" focusable="false" />
                  </div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---- Comparison (semantic table) ----------------------------------- */}
      <section
        aria-labelledby="compare-heading"
        className="border-b bg-secondary/30 py-20 dark:bg-transparent"
      >
        <div className="container max-w-3xl">
          <Reveal className="mb-10 text-center">
            <h2 id="compare-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
              {t("home.compare.title")}
            </h2>
            <p className="mt-2 text-muted-foreground">{t("home.compare.subtitle")}</p>
          </Reveal>
          <Reveal variants={scaleIn}>
            <Card className="overflow-hidden shadow-md">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">
                  Feature comparison: InfluenceHub versus going without it
                </caption>
                <thead>
                  <tr className="border-b bg-secondary/60 text-left">
                    <th scope="col" className="p-4 font-semibold">
                      {t("home.compare.feature")}
                    </th>
                    <th scope="col" className="p-4 text-center font-semibold text-muted-foreground">
                      {t("home.compare.without")}
                    </th>
                    <th scope="col" className="p-4 text-center font-semibold text-primary">
                      {t("home.compare.with")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([label, without, withHub]) => (
                    <tr key={label} className="border-b last:border-0">
                      <td className="p-4">{label}</td>
                      <td className="p-4">
                        <span className="flex justify-center">
                          <span className="sr-only">{without ? "Yes" : "No"}</span>
                          {without ? (
                            <Check className="h-5 w-5 text-primary" aria-hidden="true" focusable="false" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" focusable="false" />
                          )}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex justify-center">
                          <span className="sr-only">{withHub ? "Yes" : "No"}</span>
                          {withHub ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10">
                              <Check className="h-4 w-4 text-primary" aria-hidden="true" focusable="false" />
                            </span>
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" focusable="false" />
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* ---- Testimonials -------------------------------------------------- */}
      <section aria-labelledby="testimonials-heading" className="container border-b py-20">
        <Reveal className="mb-10 text-center">
          <h2 id="testimonials-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
            {t("home.testimonials.title")}
          </h2>
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
                  <Quote className="h-6 w-6 text-primary/30" aria-hidden="true" focusable="false" />
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
      <section aria-labelledby="cta-heading" className="container py-20">
        <Reveal variants={scaleIn}>
          <div className="relative overflow-hidden rounded-2xl gradient-primary p-10 text-center text-primary-foreground shadow-glow-lg sm:p-14">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-grid opacity-20 [mask-image:radial-gradient(ellipse_at_center,#000,transparent_75%)]"
            />
            <div className="relative">
              <h2 id="cta-heading" className="text-3xl font-bold tracking-tight md:text-4xl">
                {t("home.finalCta.title")}
              </h2>
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
