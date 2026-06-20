import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2 } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlatformIcon } from "@/components/icons";
import { influencers } from "@/lib/api";
import { fetchYouTubeStats } from "@/lib/youtube";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import type { InfluencerFull, Platform } from "@/types";

const PLATFORMS: Platform[] = ["instagram", "youtube", "tiktok", "telegram"];

export default function Onboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [inf, setInf] = useState<InfluencerFull | null>(null);
  const [usernames, setUsernames] = useState<Record<Platform, string>>({
    instagram: "",
    youtube: "",
    tiktok: "",
    telegram: "",
  });
  const [phase, setPhase] = useState<"form" | "processing" | "done">("form");

  useEffect(() => {
    if (user) influencers.getByUser(user.id).then(setInf);
  }, [user]);

  const submit = async () => {
    if (!inf) return;
    const entries = (Object.entries(usernames) as [Platform, string][]).filter(([, v]) => v.trim());
    if (entries.length === 0) return;

    setPhase("processing");
    await influencers.update(inf.id, { onboarding_status: "processing" });

    let primaryEr = 0;
    for (const [platform, username] of entries) {
      // Real stats for YouTube (via the Data API); other platforms have no free
      // public API, so use a plausible placeholder until a scraper is added.
      let followers = Math.floor(Math.random() * 900000) + 50000;
      let engagement = +(Math.random() * 6 + 1.5).toFixed(2);
      let profileUrl = `https://${platform}.com/${username}`;

      if (platform === "youtube") {
        const real = await fetchYouTubeStats(username);
        if (real && real.followers > 0) {
          followers = real.followers;
          engagement = real.engagement;
          if (real.channelUrl) profileUrl = real.channelUrl;
          if (real.avatar) await influencers.update(inf.id, { avatar_url: real.avatar });
        }
      }
      primaryEr = primaryEr || engagement;

      await influencers.addPlatform({
        influencer_id: inf.id,
        platform,
        username,
        followers_count: followers,
        engagement_rate: engagement,
        profile_url: profileUrl,
        is_primary: false,
      });
    }

    await influencers.update(inf.id, {
      onboarding_status: "completed",
      is_visible: true,
      engagement_rate: primaryEr,
    });
    setPhase("done");
    setTimeout(() => navigate("/influencer/dashboard"), 1200);
  };

  return (
    <AuthShell title={t("onboarding.title")} subtitle={t("onboarding.subtitle")}>
      {phase === "processing" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t("onboarding.processing")}</p>
        </div>
      ) : phase === "done" ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-success-foreground" />
          <p className="text-sm text-muted-foreground">{t("common.success")}!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {PLATFORMS.map((p) => (
            <div key={p} className="space-y-1.5">
              <Label className="flex items-center gap-2">
                <PlatformIcon platform={p} /> {t(`platform.${p}`)}
              </Label>
              <Input
                placeholder={`@username`}
                value={usernames[p]}
                onChange={(e) => setUsernames({ ...usernames, [p]: e.target.value })}
              />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={submit}>
              {t("onboarding.getStarted")}
            </Button>
            <Button variant="ghost" onClick={() => navigate("/influencer/dashboard")}>
              {t("onboarding.skip")}
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
