import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common";
import { brands, campaigns as campaignApi } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import type { Category, Platform } from "@/types";

const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "telegram"];
const CATEGORIES: Category[] = [
  "food",
  "tech",
  "fashion",
  "lifestyle",
  "education",
  "travel",
  "beauty",
  "sports",
  "entertainment",
  "business",
  "auto",
];

const schema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Add a short description"),
  requirements: z.string().optional(),
  budget_usd: z.coerce.number().positive("Enter a budget"),
  platform: z.enum(["instagram", "youtube", "tiktok", "telegram"]),
  category: z.string(),
  deadline: z.string().optional(),
  status: z.enum(["draft", "open"]),
});
type Values = z.infer<typeof schema>;

export default function NewCampaign() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { platform: "instagram", category: "fashion", status: "open" },
  });

  const onSubmit = async (values: Values) => {
    if (!user) return;
    const bp = await brands.profileForUser(user.id);
    if (!bp) return;
    await campaignApi.create({
      brand_id: bp.id,
      title: values.title,
      description: values.description,
      requirements: values.requirements ?? null,
      budget_usd: values.budget_usd,
      platform: values.platform,
      category: values.category as Category,
      status: values.status,
      deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
    });
    toast({ title: t("common.success"), variant: "success" });
    navigate("/brand/campaigns");
  };

  return (
    <div>
      <PageHeader title={t("campaigns.newCampaign")} />
      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("campaigns.nameLabel")}</Label>
              <Input {...register("title")} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t("influencer.description")}</Label>
              <Textarea rows={3} {...register("description")} />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("campaigns.requirements")}</Label>
              <Textarea rows={2} {...register("requirements")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("campaigns.budget")} ($)</Label>
                <Input type="number" {...register("budget_usd")} />
                {errors.budget_usd && (
                  <p className="text-xs text-destructive">{errors.budget_usd.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>{t("campaigns.deadline")}</Label>
                <Input type="date" {...register("deadline")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("league.platform")}</Label>
                <Select
                  value={watch("platform")}
                  onValueChange={(v) => setValue("platform", v as Platform)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(`platform.${p}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("league.category")}</Label>
                <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(`category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("common.status")}</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(v) => setValue("status", v as "draft" | "open")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {t("common.create")}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate("/brand/campaigns")}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
