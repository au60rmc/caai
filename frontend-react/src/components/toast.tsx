import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "../lib/format";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  title: string;
  desc?: string;
  tone: Tone;
}
interface ToastApi {
  toast: (t: { title: string; desc?: string; tone?: Tone }) => void;
}
const ToastCtx = createContext<ToastApi | null>(null);

let idc = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const toast = useCallback((t: { title: string; desc?: string; tone?: Tone }) => {
    const id = ++idc;
    setItems((s) => [...s, { id, title: t.title, desc: t.desc, tone: t.tone || "info" }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[340px] max-w-[90vw]">
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "rounded-md border bg-background shadow-lg p-3.5 pr-6 text-sm fade-up",
              t.tone === "error" && "border-destructive",
              t.tone === "success" && "border-[var(--teal)]"
            )}
          >
            <div className="font-semibold">{t.title}</div>
            {t.desc && <div className="text-muted-foreground text-[13px] mt-0.5">{t.desc}</div>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
