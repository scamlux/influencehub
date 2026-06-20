import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { auth } from "@/lib/api";
import type { AuthUser, UserRole } from "@/types";

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  loginWithGoogle: () => Promise<AuthUser>;
  register: (p: {
    email: string;
    password: string;
    full_name: string;
    role: UserRole;
  }) => Promise<AuthUser>;
  setRole: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const u = await auth.getUser();
    setUser(u);
  }, []);

  useEffect(() => {
    auth.getUser().then((u) => {
      setUser(u);
      setLoading(false);
    });
    // Keep state in sync with live Supabase session changes (token refresh,
    // sign-out in another tab, OAuth redirect return). No-op in mock mode.
    const unsub = auth.onAuthChange((u) => setUser(u));
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await auth.login(email, password);
    setUser(u);
    return u;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    const u = await auth.loginWithGoogle();
    setUser(u);
    return u;
  }, []);

  const register = useCallback(
    async (p: { email: string; password: string; full_name: string; role: UserRole }) => {
      const u = await auth.register(p);
      setUser(u);
      return u;
    },
    [],
  );

  const setRole = useCallback(
    async (role: UserRole) => {
      if (!user) return;
      await auth.setRole(user.id, role);
      await refresh();
    },
    [user, refresh],
  );

  const logout = useCallback(async () => {
    await auth.logout();
    setUser(null);
  }, []);

  return (
    <Ctx.Provider
      value={{ user, loading, login, loginWithGoogle, register, setRole, logout, refresh }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
