import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { transition } from "@/lib/motion";

type ToastVariant = "default" | "success" | "warning" | "error";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  action?: ToastAction;
}

interface ToastInput {
  title: string;
  description?: string;
  variant?: ToastVariant;
  /** Optional inline action, e.g. "Undo" for a reversible operation. */
  action?: ToastAction;
}

interface ToastCtx {
  toast: (t: ToastInput) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

const ICON = {
  success: <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-500" />,
  error: <XCircle className="mt-0.5 h-5 w-5 text-destructive" />,
  warning: <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />,
  default: <Info className="mt-0.5 h-5 w-5 text-primary" />,
} as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback(
    (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id)),
    [],
  );

  const toast = useCallback(
    ({ title, description, variant = "default", action }: ToastInput) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, title, description, variant, action }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              transition={transition.base}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-background p-4 shadow-lg",
                t.variant === "warning" && "border-amber-500/40",
                t.variant === "error" && "border-destructive/40",
              )}
            >
              {ICON[t.variant]}
              <div className="flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
              </div>
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    remove(t.id);
                  }}
                  className="shrink-0 text-sm font-medium text-primary hover:underline"
                >
                  {t.action.label}
                </button>
              )}
              <button
                onClick={() => remove(t.id)}
                aria-label="Dismiss"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
