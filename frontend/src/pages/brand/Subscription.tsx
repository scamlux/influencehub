import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PlanCard } from "@/components/PlanCard";
import { PageHeader } from "@/components/common";
import { PLANS } from "@/lib/plans";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";

export default function BrandSubscription() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const { active, isBrandPro, checkout, refresh, loading } = useSubscription();
  const [processing, setProcessing] = useState(false);
  const [params, setParams] = useSearchParams();
  const plan = PLANS.find((p) => p.plan === "brand_pro")!;

  // Handle the redirect back from Stripe Checkout. The webhook activates the
  // subscription server-side; we just refresh + toast and clear the query.
  useEffect(() => {
    const status = params.get("checkout");
    if (!status) return;
    if (status === "success") {
      toast({ title: t("common.success"), variant: "success" });
      refresh();
    } else if (status === "cancelled") {
      toast({ title: "Checkout cancelled", variant: "error" });
    }
    params.delete("checkout");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subscribe = async (method: "stripe" | "payme") => {
    setProcessing(true);
    try {
      const res = await checkout("brand_pro", method);
      // If the provider redirected to hosted checkout the page is already
      // navigating away; otherwise the sub was activated directly (no provider
      // key configured) — give explicit feedback so the button never feels dead.
      if (!(res && "redirected" in res)) {
        toast({ title: t("subscription.activated"), variant: "success" });
      }
    } catch (e) {
      // Surface a clear message instead of a generic "something went wrong" —
      // most commonly the payment provider isn't configured on this deployment.
      const msg = e instanceof Error && e.message ? e.message : "";
      toast({
        title: method === "stripe" ? t("subscription.payStripe") : t("subscription.payPayme"),
        description: msg || t("subscription.paymentUnavailable"),
        variant: "error",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div>
      <PageHeader title={t("subscription.title")} subtitle={t("subscription.subtitle")} />

      {isBrandPro && active && (
        <Card className="mb-6 border-success">
          <CardContent className="flex items-center gap-3 p-5">
            <CheckCircle2 className="h-6 w-6 text-success-foreground" />
            <div>
              <p className="font-semibold">
                {t("subscription.active")} — {t("common.pro")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("subscription.expiresAt")}: {formatDate(active.expires_at)}
              </p>
            </div>
            <Badge variant="success" className="ml-auto">
              {t("subscription.active")}
            </Badge>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <PlanCard
          plan={plan}
          cta={t("subscription.subscribe")}
          current={isBrandPro}
          loading={loading}
        />
        <Card>
          <CardContent className="flex h-full flex-col justify-center gap-3 p-6">
            <h3 className="font-semibold">{t("subscription.subscribe")}</h3>
            <p className="text-sm text-muted-foreground">
              Choose a payment method to activate Brand Pro instantly.
            </p>
            <Button onClick={() => subscribe("stripe")} disabled={processing || isBrandPro}>
              <CreditCard className="h-4 w-4" /> {t("subscription.payStripe")}
            </Button>
            <Button
              variant="outline"
              onClick={() => subscribe("payme")}
              disabled={processing || isBrandPro}
            >
              {t("subscription.payPayme")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
