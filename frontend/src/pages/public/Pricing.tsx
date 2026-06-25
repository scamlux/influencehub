import { useNavigate } from "react-router-dom";
import { Sparkles, ShieldCheck } from "lucide-react";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PlanCard } from "@/components/PlanCard";
import { Reveal } from "@/components/motion";
import { PLANS } from "@/lib/plans";
import { useLanguage } from "@/hooks/useLanguage";

export default function Pricing() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-15%] -z-10 h-[420px] w-[760px] max-w-[120vw] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,hsl(var(--primary)/0.14),transparent_65%)] blur-2xl"
        />
        <div className="container py-16 sm:py-20">
          <Reveal className="mb-12 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/70 px-4 py-1.5 text-sm font-medium shadow-xs backdrop-blur">
              <Sparkles className="h-4 w-4 text-primary" />
              {t("nav.pricing")}
            </span>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl">
              {t("subscription.title")}
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{t("subscription.subtitle")}</p>
          </Reveal>

          <div className="mx-auto grid max-w-5xl items-start gap-6 md:grid-cols-3">
            {PLANS.map((plan, i) => (
              <PlanCard
                key={plan.plan}
                plan={plan}
                cta={t("subscription.subscribe")}
                onSelect={() => navigate("/register")}
                delay={i * 0.1}
              />
            ))}
          </div>

          <Reveal className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground" delay={0.1}>
            <ShieldCheck className="h-4 w-4 text-primary" />
            Cancel anytime · Secure checkout via Stripe
          </Reveal>
        </div>
      </section>
    </PublicLayout>
  );
}
