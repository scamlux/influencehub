import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn, initials } from "@/lib/utils";
import { avatarCandidates } from "@/lib/avatar";
import type { Platform } from "@/types";

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-secondary",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  // Instagram / TikTok / Facebook CDNs reject hot-linked requests that carry a
  // Referer header (the avatars 403 in the browser). Sending no referrer makes
  // them serve the image, matching how the daily refresh fetches fresh URLs.
  <AvatarPrimitive.Image
    ref={ref}
    referrerPolicy="no-referrer"
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

/**
 * InfluencerAvatar — guarantees every blogger shows a photo.
 *
 * Renders initials as the base layer, then overlays a profile photo that is
 * resolved through a fallback chain (stored URL → Instagram via unavatar →
 * other socials → deterministic face). Each failed source advances to the next
 * via onError, so a broken/expired Instagram CDN link never leaves a blank
 * avatar. See {@link avatarCandidates}.
 */
export function InfluencerAvatar({
  name,
  avatarUrl,
  platforms,
  className,
  fallbackClassName,
}: {
  name: string;
  avatarUrl?: string | null;
  platforms?: { platform: Platform; username: string | null }[];
  className?: string;
  fallbackClassName?: string;
}) {
  const sources = React.useMemo(
    () => avatarCandidates({ avatarUrl, platforms }),
    [avatarUrl, platforms],
  );
  const [idx, setIdx] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);

  // Reset when the resolved candidate list changes (e.g. data loads in).
  React.useEffect(() => {
    setIdx(0);
    setLoaded(false);
  }, [sources]);

  const src = sources[idx];

  return (
    <span
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary",
        className,
      )}
    >
      <span
        aria-hidden={loaded}
        className={cn(
          "select-none text-sm font-medium text-muted-foreground",
          fallbackClassName,
        )}
      >
        {initials(name)}
      </span>
      {src && (
        <img
          key={src}
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => {
            setLoaded(false);
            setIdx((i) => i + 1);
          }}
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
