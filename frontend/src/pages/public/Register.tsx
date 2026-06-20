import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Briefcase, Star } from "lucide-react";
import { AuthShell } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { dashboardPath } from "@/components/RoleGuard";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const schema = z
  .object({
    full_name: z.string().min(2, "Enter your name"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(6, "Min 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
type Values = z.infer<typeof schema>;

export default function Register() {
  const { t } = useLanguage();
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("brand");
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: Values) => {
    setError("");
    try {
      const user = await signUp({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        role,
      });
      navigate(role === "influencer" ? "/influencer/onboard" : dashboardPath(user.role));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <AuthShell title={t("auth.register")} subtitle="Join the marketplace in seconds">
      <div className="mb-5">
        <Label className="mb-2 block">{t("auth.selectRole")}</Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              value: "brand" as const,
              icon: Briefcase,
              label: t("auth.brand"),
              desc: t("auth.brandDesc"),
            },
            {
              value: "influencer" as const,
              icon: Star,
              label: t("auth.influencer"),
              desc: t("auth.influencerDesc"),
            },
          ].map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={cn(
                "rounded-xl border p-4 text-left transition-colors",
                role === r.value
                  ? "border-primary bg-primary/5 dark:bg-pink-500/20 dark:border-pink-500"
                  : "hover:bg-secondary dark:bg-white/5 dark:border-white/10 dark:hover:bg-white/10",
              )}
            >
              <r.icon
                className={cn(
                  "h-5 w-5",
                  role === r.value ? "text-primary" : "text-muted-foreground",
                )}
              />
              <p className="mt-2 font-medium">{r.label}</p>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">{t("auth.fullName")}</Label>
          <Input
            id="full_name"
            className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            {...register("full_name")}
          />
          {errors.full_name && (
            <p className="text-xs text-destructive">{errors.full_name.message}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            {...register("email")}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            {...register("password")}
          />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">{t("auth.confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            className="dark:bg-white/5 dark:border-white/10 dark:text-white dark:placeholder:text-white/40"
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {t("auth.register")}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link to="/login" className="font-medium text-primary hover:underline dark:text-pink-400">
          {t("nav.login")}
        </Link>
      </p>
    </AuthShell>
  );
}
