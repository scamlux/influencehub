import { useNavigate } from "react-router-dom";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { PlanCard } from "@/components/PlanCard";
import { PLANS } from "@/lib/plans";
import { useLanguage } from "@/hooks/useLanguage";

export default function Pricing() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <PublicLayout>
      <div className="container py-16 dark:bg-background">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold">{t("subscription.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("subscription.subtitle")}</p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
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
      </div>
    </PublicLayout>
  );
}
