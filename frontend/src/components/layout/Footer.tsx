import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

export function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t bg-secondary/30 dark:bg-[#0a0a12] dark:border-t dark:border-border">
      <div className="container flex flex-col items-center justify-between gap-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
            <Sparkles className="h-4 w-4 text-white" aria-hidden="true" focusable="false" />
          </div>
          <span className="font-semibold">
            Influence<span className="text-primary">Hub</span>
          </span>
          <span className="ml-2 text-sm text-muted-foreground dark:text-muted-foreground">
            {t("footer.tagline")}
          </span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground dark:text-muted-foreground">
          <Link
            to="/league"
            className="hover:text-foreground dark:text-muted-foreground dark:hover:text-white"
          >
            {t("nav.league")}
          </Link>
          <Link
            to="/pricing"
            className="hover:text-foreground dark:text-muted-foreground dark:hover:text-white"
          >
            {t("nav.pricing")}
          </Link>
          <Link
            to="/terms"
            className="hover:text-foreground dark:text-muted-foreground dark:hover:text-white"
          >
            {t("footer.terms")}
          </Link>
          <Link
            to="/privacy"
            className="hover:text-foreground dark:text-muted-foreground dark:hover:text-white"
          >
            {t("footer.privacy")}
          </Link>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground dark:border-border dark:text-muted-foreground">
        © {new Date().getFullYear()} InfluenceHub. {t("footer.rights")}
      </div>
    </footer>
  );
}
