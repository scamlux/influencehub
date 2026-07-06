import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowLeft, MessageSquare, ShieldCheck, Wallet } from "lucide-react";
import { deals as dealApi, influencers, campaigns } from "@/lib/api";
import { DealStepper } from "@/components/campaign/DealStepper";
import { Celebration } from "@/components/campaign/Celebration";
import { StatusBadge } from "@/components/campaign/DealStatusBadge";
import { Button } from "@/components/ui/button";
import { PageLoader, ErrorState } from "@/components/common";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { allowedActions, type DealAction } from "@/lib/deal-status";
import { transition } from "@/lib/motion";
import { formatUSD } from "@/lib/utils";
import type { Deal, DealPayment, UserRole } from "@/types";

const backForRole: Record<string, string> = {
  brand: "/brand/deals",
  influencer: "/influencer/deals",
  admin: "/admin/deals",
};

const chatForRole: Record<string, (id: string) => string> = {
  brand: (id) => `/brand/chat/${id}`,
  influencer: (id) => `/influencer/chat/${id}`,
};

export default function DealDetail() {
  const { dealId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const role: UserRole = user?.role ?? "brand";

  const [deal, setDeal] = useState<Deal | null>(null);
  const [payment, setPayment] = useState<DealPayment | null>(null);
  const [counterpart, setCounterpart] = useState("");
  const [campaignTitle, setCampaignTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(0);

  const load = useCallback(async () => {
    const d = await dealApi.get(dealId);
    setDeal(d);
    if (d) {
      const [inf, camp, pay] = await Promise.all([
        influencers.get(d.influencer_id),
        campaigns.get(d.campaign_id),
        dealApi.paymentFor(d.id),
      ]);
      setCounterpart(inf?.display_name ?? "");
      setCampaignTitle(camp?.title ?? "");
      setPayment(pay);
    }
    setLoading(false);
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, successKey: string, celebrateOnDone = false) => {
    setBusy(true);
    try {
      await fn();
      if (celebrateOnDone) setCelebrate((n) => n + 1);
      toast({ title: t(successKey), variant: "success" });
      await load();
    } catch (e) {
      toast({ title: t("common.error"), description: String(e), variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const fund = () =>
    run(
      async () => {
        const res = await dealApi.fund(dealId);
        if (res.checkout_url) window.location.href = res.checkout_url;
      },
      "deal.toast.funded",
      true,
    );

  const act = (action: DealAction, successKey: string) =>
    run(() => dealApi.advance(dealId, action, role), successKey);

  if (loading) return <PageLoader />;
  if (!deal) return <ErrorState title={t("deals.noDeals")} />;

  const actions = allowedActions(deal.status, role);
  const gross = Number(deal.agreed_price);
  const feeUsd = payment ? payment.fee_cents / 100 : gross * 0.12;
  const payoutUsd = payment ? payment.payout_cents / 100 : gross - feeUsd;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Celebration fireKey={celebrate} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(backForRole[role] ?? "/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{campaignTitle || t("deals.title")}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {counterpart} · {t("deals.agreedPrice")}: {formatUSD(gross)}
          </p>
        </div>
        <StatusBadge status={deal.status} />
      </div>

      {/* Escrow stepper — the visual centerpiece. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={transition.base}
        className="rounded-xl border bg-card p-6"
      >
        <DealStepper status={deal.status} />
      </motion.div>

      {/* Escrow money breakdown. */}
      <div className="grid grid-cols-3 gap-3">
        <Money label={t("deal.escrow.gross")} value={formatUSD(gross)} icon={Wallet} />
        <Money label={t("deal.escrow.fee")} value={formatUSD(feeUsd)} hint="12%" />
        <Money label={t("deal.escrow.payout")} value={formatUSD(payoutUsd)} accent />
      </div>
      {payment && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          {t(`deal.escrow.status.${payment.status}`)}
        </p>
      )}

      {/* Role-based actions. */}
      <div className="flex flex-wrap items-center gap-2">
        {role === "brand" && (actions as string[]).includes("fund") && (
          <Button onClick={fund} disabled={busy} className="active:scale-[0.98]">
            <Wallet className="h-4 w-4" /> {t("deal.action.fund")}
          </Button>
        )}
        {actions.includes("start") && (
          <Button onClick={() => act("start", "deal.toast.started")} disabled={busy}>
            {t("deal.action.start")}
          </Button>
        )}
        {actions.includes("deliver") && (
          <Button onClick={() => act("deliver", "deal.toast.delivered")} disabled={busy}>
            {t("deal.action.deliver")}
          </Button>
        )}
        {actions.includes("release") && (
          <Button
            onClick={() => act("release", "deal.toast.released")}
            disabled={busy}
            className="active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" /> {t("deal.action.release")}
          </Button>
        )}
        {actions.includes("resolve_release") && (
          <Button onClick={() => act("resolve_release", "deal.toast.released")} disabled={busy}>
            {t("deal.action.resolveRelease")}
          </Button>
        )}
        {actions.includes("resolve_refund") && (
          <Button
            variant="destructive"
            onClick={() => act("resolve_refund", "deal.toast.refunded")}
            disabled={busy}
          >
            {t("deal.action.resolveRefund")}
          </Button>
        )}
        {actions.includes("dispute") && (
          <Button
            variant="outline"
            onClick={() => act("dispute", "deal.toast.disputed")}
            disabled={busy}
          >
            {t("deal.action.dispute")}
          </Button>
        )}
        {chatForRole[role] && (
          <Button variant="ghost" asChild>
            <Link to={chatForRole[role](dealId)}>
              <MessageSquare className="h-4 w-4" /> {t("deals.openChat")}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function Money({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${accent ? "border-primary/40 bg-primary/5" : "bg-card"}`}
    >
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${accent ? "text-primary" : ""}`}>
        {value}
        {hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{hint}</span>}
      </p>
    </div>
  );
}
