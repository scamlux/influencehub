import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { dashboardPath } from "@/components/RoleGuard";
import { USE_MOCK_DATA } from "@/lib/supabase";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type Values = z.infer<typeof schema>;

export default function Login() {
  const { t } = useLanguage();
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setError("");
    try {
      const user = await login(values.email, values.password);
      const from = (location.state as { from?: string })?.from;
      navigate(from ?? dashboardPath(user.role), { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AuthShell title={t("auth.login")} subtitle="Welcome back to InfluenceHub">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Link
              to="/forgot-password"
              className="text-xs text-primary hover:underline dark:text-pink-400"
            >
              {t("auth.forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {t("auth.login")}
        </Button>
      </form>

      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <div className="h-px flex-1 bg-border" />
      </div>
      <Button
        variant="outline"
        className="w-full dark:bg-white/10 dark:border-white/10 dark:text-white"
        onClick={async () => {
          const u = await loginWithGoogle();
          navigate(dashboardPath(u.role));
        }}
      >
        {t("auth.continueGoogle")}
      </Button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link
          to="/register"
          className="font-medium text-primary hover:underline dark:text-pink-400"
        >
          {t("nav.register")}
        </Link>
      </p>

      {USE_MOCK_DATA ? (
        <div className="mt-6 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground dark:bg-white/5 dark:border dark:border-white/10 dark:text-muted-foreground">
          <p className="font-medium text-foreground">Demo accounts (any password):</p>
          <p>brand@influencehub.uz · influencer@influencehub.uz · admin@influencehub.uz</p>
        </div>
      ) : (
        <div className="mt-6 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground dark:bg-white/5 dark:border dark:border-white/10 dark:text-muted-foreground">
          <p className="font-medium text-foreground">
            Seeded demo accounts — password: Password123!
          </p>
          <p>
            brand1@demo.influencehub.app · test-inf1@demo.influencehub.app ·
            admin1@demo.influencehub.app
          </p>
        </div>
      )}
    </AuthShell>
  );
}
