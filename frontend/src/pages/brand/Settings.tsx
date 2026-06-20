import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { useToast } from "@/components/ui/toast";
import { initials } from "@/lib/utils";

const INDUSTRIES = [
  "retail",
  "tech",
  "food",
  "fashion",
  "beauty",
  "finance",
  "telecom",
  "automotive",
  "entertainment",
  "other",
];

export default function BrandSettings() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const logoRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    full_name: user?.full_name ?? "",
    description: "",
    website: "",
    industry: "retail",
    logo_url: "",
  });

  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const onPickLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image must be under 2MB", variant: "error" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => ({ ...p, logo_url: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: t("common.success"), variant: "success" });
  };

  const savePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.next.length < 6) {
      toast({ title: t("auth.password") + ": min 6 characters", variant: "error" });
      return;
    }
    if (pw.next !== pw.confirm) {
      toast({ title: t("settings.passwordMismatch"), variant: "error" });
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast({ title: t("settings.passwordUpdated"), variant: "success" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("nav.settings")} />

      {/* Brand profile */}
      <Card className="max-w-2xl dark:bg-card dark:border dark:border-border">
        <CardHeader>
          <CardTitle>{t("settings.brandProfile")}</CardTitle>
          <CardDescription>{t("influencer.basicInfoDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="space-y-2">
              <Label>{t("settings.logo")}</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 rounded-xl ring-2 ring-border dark:border-border">
                  <AvatarImage src={profile.logo_url || undefined} />
                  <AvatarFallback className="rounded-xl dark:bg-secondary dark:border-border">
                    {initials(profile.full_name || "?")}
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={logoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => logoRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> {t("influencer.uploadPhoto")}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings.companyName")}</Label>
              <Input
                value={profile.full_name}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("auth.email")}</Label>
              <Input type="email" defaultValue={user?.email} disabled />
            </div>

            <div className="space-y-1.5">
              <Label>{t("settings.companyDescription")}</Label>
              <Textarea
                rows={3}
                placeholder={t("settings.companyDescPlaceholder")}
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("settings.website")}</Label>
                <Input
                  type="url"
                  placeholder="https://example.com"
                  value={profile.website}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.industry")}</Label>
                <Select
                  value={profile.industry}
                  onValueChange={(v) => setProfile({ ...profile, industry: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i} className="capitalize">
                        {i}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button type="submit">{t("common.save")}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="max-w-2xl dark:bg-card dark:border dark:border-border">
        <CardHeader>
          <CardTitle>{t("settings.security")}</CardTitle>
          <CardDescription>{t("settings.changePassword")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={savePassword}>
            <div className="space-y-1.5">
              <Label>{t("settings.currentPassword")}</Label>
              <Input
                type="password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("settings.newPassword")}</Label>
                <Input
                  type="password"
                  value={pw.next}
                  onChange={(e) => setPw({ ...pw, next: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("settings.confirmNewPassword")}</Label>
                <Input
                  type="password"
                  value={pw.confirm}
                  onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                />
              </div>
            </div>
            <Button type="submit">{t("settings.changePassword")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
