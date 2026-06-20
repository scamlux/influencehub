import { Instagram, Youtube, Music2, Send } from "lucide-react";
import type { Platform } from "@/types";

export const platformIcon: Record<Platform, React.ComponentType<{ className?: string }>> = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  telegram: Send,
};

export const platformColor: Record<Platform, string> = {
  instagram: "text-pink-600",
  youtube: "text-red-600",
  tiktok: "text-foreground",
  telegram: "text-sky-500",
};

export function PlatformIcon({ platform, className }: { platform: Platform; className?: string }) {
  const Icon = platformIcon[platform];
  return <Icon className={className ?? `h-4 w-4 ${platformColor[platform]}`} />;
}
