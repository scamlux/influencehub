import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

const STORAGE_KEY = "influencehub_compare_v1";
export const MAX_COMPARE = 3;

function loadInitial(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return (JSON.parse(raw) as string[]).slice(0, MAX_COMPARE);
  } catch {
    /* ignore */
  }
  return [];
}

interface CompareCtx {
  selected: string[];
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  set: (ids: string[]) => void;
  full: boolean;
}

const Ctx = createContext<CompareCtx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<string[]>(loadInitial);

  const persist = useCallback((next: string[]) => {
    setSelected(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(
    (id: string) =>
      persist(
        selected.includes(id)
          ? selected.filter((x) => x !== id)
          : selected.length >= MAX_COMPARE
            ? selected
            : [...selected, id],
      ),
    [selected, persist],
  );

  const remove = useCallback(
    (id: string) => persist(selected.filter((x) => x !== id)),
    [selected, persist],
  );

  const clear = useCallback(() => persist([]), [persist]);
  const set = useCallback((ids: string[]) => persist(ids.slice(0, MAX_COMPARE)), [persist]);

  return (
    <Ctx.Provider
      value={{
        selected,
        isSelected: (id) => selected.includes(id),
        toggle,
        remove,
        clear,
        set,
        full: selected.length >= MAX_COMPARE,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCompare(): CompareCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}
