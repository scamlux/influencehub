import { useEffect, useState } from "react";
import { Plus, Trash2, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, PageLoader, EmptyState } from "@/components/common";
import { influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { formatUSD } from "@/lib/utils";
import type { AdType, AdvertisingPrice, InfluencerFull } from "@/types";

const AD_TYPES: AdType[] = ["post", "story", "video", "reel", "package", "native"];

export default function InfluencerPricing() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [inf, setInf] = useState<InfluencerFull | null>(null);
  const [prices, setPrices] = useState<AdvertisingPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    ad_type: "post" as AdType,
    price_usd: "",
    description: "",
    duration: "permanent",
    delivery_days: "7",
    is_public: true,
  });

  const load = () => {
    if (!user) return;
    influencers.getByUser(user.id).then((d) => {
      setInf(d);
      setPrices(d?.prices ?? []);
      setLoading(false);
    });
  };
  useEffect(load, [user]);

  const add = async () => {
    if (!inf || !draft.price_usd) return;
    try {
      await influencers.addPrice({
        influencer_id: inf.id,
        ad_type: draft.ad_type,
        price_usd: Number(draft.price_usd),
        description: draft.description,
        duration: draft.duration,
        delivery_days: Number(draft.delivery_days),
        is_public: draft.is_public,
      });
      toast({ title: t("influencer.pricingSaved"), variant: "success" });
      setOpen(false);
      setDraft({ ...draft, price_usd: "", description: "" });
      load();
    } catch {
      toast({ title: t("influencer.errorSavingPricing"), variant: "error" });
    }
  };

  const remove = async (id: string) => {
    await influencers.deletePrice(id);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title={t("influencer.managePricing")}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t("influencer.addPrice")}
          </Button>
        }
      />

      {prices.length === 0 ? (
        <EmptyState
          icon={DollarSign}
          title={t("common.none")}
          action={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {t("influencer.addPrice")}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {prices.map((p) => (
            <Card key={p.id} className="dark:bg-card dark:border dark:border-border">
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary">{t(`adType.${p.ad_type}`)}</Badge>
                  <div>
                    <p className="font-semibold">{formatUSD(p.price_usd)}</p>
                    <p className="text-xs text-muted-foreground">{p.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={p.is_public ? "outline" : "muted"}>
                    {p.is_public ? t("influencer.visibleToAll") : t("influencer.subscribersOnly")}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{p.delivery_days}d</span>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("influencer.addPrice")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("influencer.contentType")}</Label>
                <Select
                  value={draft.ad_type}
                  onValueChange={(v) => setDraft({ ...draft, ad_type: v as AdType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_TYPES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {t(`adType.${a}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("influencer.publicPrice")} ($)</Label>
                <Input
                  type="number"
                  value={draft.price_usd}
                  onChange={(e) => setDraft({ ...draft, price_usd: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("influencer.description")}</Label>
              <Textarea
                rows={2}
                placeholder={t("influencer.priceDescPlaceholder")}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("influencer.duration")}</Label>
                <Input
                  value={draft.duration}
                  onChange={(e) => setDraft({ ...draft, duration: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("campaigns.deliveryDays")}</Label>
                <Input
                  type="number"
                  value={draft.delivery_days}
                  onChange={(e) => setDraft({ ...draft, delivery_days: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>{t("influencer.publicPrice")}</Label>
              <Switch
                checked={draft.is_public}
                onCheckedChange={(v) => setDraft({ ...draft, is_public: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={add}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
