import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bids } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/hooks/useLanguage";
import type { Campaign } from "@/types";

const schema = z.object({
  proposed_price: z.coerce.number().positive("Enter a valid price"),
  proposal: z.string().min(10, "Tell the brand a bit more (min 10 chars)"),
  delivery_days: z.coerce.number().int().min(1).max(60),
});
type FormValues = z.infer<typeof schema>;

export function BidForm({
  campaign,
  influencerId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  campaign: Campaign;
  influencerId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmitted?: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { delivery_days: 7 },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const bid = await bids.create({
        campaign_id: campaign.id,
        influencer_id: influencerId,
        proposed_price: values.proposed_price,
        proposal: values.proposal,
        delivery_days: values.delivery_days,
      });
      toast({
        title: t("campaigns.bidSubmitted"),
        variant: "success",
        // Reversible: let the influencer pull the bid straight back.
        action: {
          label: t("common.undo"),
          onClick: async () => {
            await bids.withdraw(bid.id);
            onSubmitted?.();
          },
        },
      });
      reset();
      onOpenChange(false);
      onSubmitted?.();
    } catch (e) {
      toast({ title: t("common.error"), variant: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("campaigns.submitBid")} — {campaign.title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="proposed_price">{t("campaigns.proposedPrice")} ($)</Label>
            <Input id="proposed_price" type="number" step="0.01" {...register("proposed_price")} />
            {errors.proposed_price && (
              <p className="text-xs text-destructive">{errors.proposed_price.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="proposal">{t("campaigns.proposal")}</Label>
            <Textarea id="proposal" rows={4} {...register("proposal")} />
            {errors.proposal && (
              <p className="text-xs text-destructive">{errors.proposal.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="delivery_days">{t("campaigns.deliveryDays")}</Label>
            <Input id="delivery_days" type="number" {...register("delivery_days")} />
            {errors.delivery_days && (
              <p className="text-xs text-destructive">{errors.delivery_days.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={submitting}>
              {t("common.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
