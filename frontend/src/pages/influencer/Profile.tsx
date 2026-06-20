import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, PageLoader } from "@/components/common";
import { influencers } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import type { Category, InfluencerFull } from "@/types";

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

export default function InfluencerProfile() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [inf, setInf] = useState<InfluencerFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    category: "lifestyle" as Category,
    city: "",
    is_visible: true,
    avatar_url: "",
  });

  useEffect(() => {
    if (!user) return;
    influencers.getByUser(user.id).then((d) => {
      if (d) {
        setInf(d);
        setForm({
          display_name: d.display_name,
          bio: d.bio ?? "",
          category: d.category,
          city: d.city ?? "",
          is_visible: d.is_visible,
          avatar_url: d.avatar_url ?? "",
        });
      }
      setLoading(false);
    });
  }, [user]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: t("common.error"), variant: "error" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, avatar_url: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (!inf) return;
    await influencers.update(inf.id, {
      display_name: form.display_name,
      bio: form.bio,
      category: form.category,
      city: form.city,
      is_visible: form.is_visible,
      avatar_url: form.avatar_url || null,
    });
    toast({ title: t("common.success"), variant: "success" });
  };

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader
        title={t("influencer.editProfile")}
        subtitle={t("influencer.editProfileSubtitle")}
      />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>{t("influencer.basicInfo")}</CardTitle>
          <CardDescription>{t("influencer.basicInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("auth.fullName")}</Label>
            <Input
              value={form.display_name}
              placeholder={t("influencer.displayNamePlaceholder")}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("influencer.bio")}</Label>
            <Textarea
              rows={3}
              value={form.bio}
              placeholder={t("influencer.bioPlaceholder")}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("influencer.category")}</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v as Category })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("influencer.selectCategory")} />
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
              <Label>{t("influencer.city")}</Label>
              <Input
                value={form.city}
                placeholder={t("influencer.cityPlaceholder")}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("influencer.profilePhoto")}</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 ring-2 ring-border">
                <AvatarImage src={form.avatar_url || undefined} />
                <AvatarFallback>{initials(form.display_name || "?")}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    {form.avatar_url ? t("influencer.changePhoto") : t("influencer.uploadPhoto")}
                  </Button>
                  {form.avatar_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm({ ...form, avatar_url: "" })}
                    >
                      {t("common.delete")}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">PNG or JPG, up to 2MB.</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <p className="font-medium">{t("influencer.profileVisibility")}</p>
              <p className="text-sm text-muted-foreground">{t("influencer.visibilityDesc")}</p>
            </div>
            <Switch
              checked={form.is_visible}
              onCheckedChange={(v) => setForm({ ...form, is_visible: v })}
            />
          </div>
          <Button onClick={save}>{t("common.save")}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
