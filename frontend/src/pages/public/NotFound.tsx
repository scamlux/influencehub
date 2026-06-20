import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { dashboardPath } from "@/components/RoleGuard";

export default function NotFound() {
  const { t } = useLanguage();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex max-w-md flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary">
            <Compass className="h-10 w-10 text-white" />
          </div>
          <p className="text-6xl font-extrabold tracking-tight text-primary">404</p>
          <h1 className="mt-2 text-2xl font-bold">{t("notFound.title")}</h1>
          <p className="mt-2 text-muted-foreground">{t("notFound.subtitle")}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to="/">{t("notFound.home")}</Link>
            </Button>
            {user && (
              <Button asChild variant="outline">
                <Link to={dashboardPath(user.role)}>{t("notFound.dashboard")}</Link>
              </Button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
