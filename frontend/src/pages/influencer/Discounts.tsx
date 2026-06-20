import { useEffect, useState } from "react";
import { Plus, Trash2, Tag, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { formatDate } from "@/lib/utils";
import type { Discount, InfluencerFull } from "@/types";

export default function InfluencerDiscounts() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [inf, setInf] = useState<InfluencerFull | null>(null);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    description: "",
    discount_percent: "10",
    valid_until: "",
  });

  const load = () => {
    if (!user) return;
    influencers.getByUser(user.id).then((d) => {
      setInf(d);
      setDiscounts(d?.discounts ?? []);
      setLoading(false);
    });
  };
  useEffect(load, [user]);

  const add = async () => {
    if (!inf || !draft.title) return;
    await influencers.addDiscount({
      influencer_id: inf.id,
      title: draft.title,
      description: draft.description,
      discount_percent: Number(draft.discount_percent),
      valid_until: draft.valid_until ? new Date(draft.valid_until).toISOString() : null,
      is_active: true,
    });
    toast({ title: t("common.success"), variant: "success" });
    setOpen(false);
    setDraft({ title: "", description: "", discount_percent: "10", valid_until: "" });
    load();
  };

  const remove = async (id: string) => {
    await influencers.deleteDiscount(id);
    load();
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title={t("influencer.discounts")}
        subtitle={t("influencer.discountsSubtitle")}
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t("influencer.addDiscount")}
          </Button>
        }
      />

      <Card className="mb-4 border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 text-primary" />
          <div>
            <p className="font-medium">{t("influencer.discountsInfo")}</p>
            <p className="text-sm text-muted-foreground">{t("influencer.discountsInfoDesc")}</p>
          </div>
        </CardContent>
      </Card>

      {discounts.length === 0 ? (
        <EmptyState
          icon={Tag}
          title={t("influencer.noDiscountsYet")}
          description={t("influencer.addDiscountPrompt")}
          action={<Button onClick={() => setOpen(true)}>{t("influencer.addFirstDiscount")}</Button>}
        />
      ) : (
        <div className="space-y-3">
          {discounts.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Tag className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{d.title}</span>
                      <Badge>
                        {d.discount_percent}% {t("influencer.percentOff")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("influencer.validUntil")}: {formatDate(d.valid_until)}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("influencer.addDiscount")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("campaigns.title")}</Label>
              <Input
                placeholder={t("influencer.discountTitlePlaceholder")}
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("influencer.description")}</Label>
              <Textarea
                rows={2}
                placeholder={t("influencer.discountDescPlaceholder")}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t("influencer.percentOff")}</Label>
                <Input
                  type="number"
                  value={draft.discount_percent}
                  onChange={(e) => setDraft({ ...draft, discount_percent: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("influencer.validUntil")}</Label>
                <Input
                  type="date"
                  value={draft.valid_until}
                  onChange={(e) => setDraft({ ...draft, valid_until: e.target.value })}
                />
              </div>
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
