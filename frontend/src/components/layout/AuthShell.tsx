import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-pink-50 via-white to-purple-50 p-4 dark:bg-gradient-to-br dark:from-[#0d0d1a] dark:via-[#0f0a1e] dark:to-[#0d0d1a]">
      {/* Soft decorative glow blobs */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-purple-400/20 blur-3xl dark:bg-purple-600/10" />

      <Link to="/" className="z-10 mb-6 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold">
          Influence<span className="text-primary">Hub</span>
        </span>
      </Link>
      <div className="z-10 w-full max-w-md rounded-2xl border border-pink-100/50 bg-white/80 p-8 shadow-xl backdrop-blur-md dark:border dark:border-white/10 dark:bg-white/5 dark:backdrop-blur-md">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
