import { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Building2, Check, ChevronsUpDown, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { GlobalSearch } from "./GlobalSearch";

export function Topbar({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { companies, company, switchCompany } = useCompany();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const coRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (coRef.current && !coRef.current.contains(e.target as Node)) setCoOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initials = `${user?.first_name?.[0] ?? ""}${user?.last_name?.[0] ?? ""}` || "U";

  return (
    <header className="h-[60px] sticky top-0 z-30 flex items-center justify-between gap-4 px-6 lg:px-8 bg-background/85 backdrop-blur border-b border-border">
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground leading-none">
          {company?.company_name || "ImmBiz Books"}
        </div>
        <div className="text-[15px] font-semibold tracking-tight truncate">{title}</div>
      </div>

      <div className="flex items-center gap-3">
        {companies.length > 0 && (
          <div className="relative" ref={coRef}>
            <button
              type="button"
              onClick={() => setCoOpen((o) => !o)}
              className="hidden sm:flex items-center gap-2 rounded-[5px] border border-border bg-card px-2.5 py-1.5 text-xs hover:bg-muted transition-colors max-w-[220px]"
              title="Switch company"
            >
              <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate font-medium">
                {company?.company_name || "Select company"}
              </span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
            {coOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-md border bg-popover text-popover-foreground shadow-lg p-1 z-40">
                <div className="px-2 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Switch company
                </div>
                {companies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                    onClick={() => {
                      switchCompany(c.id);
                      setCoOpen(false);
                    }}
                  >
                    <span className="flex-1 truncate">{c.company_name}</span>
                    {company?.id === c.id && (
                      <Check className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--teal)" }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <GlobalSearch />
        <Link
          to="/app/subscription"
          className="hidden sm:flex items-center gap-1.5 rounded-[5px] border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300 font-medium transition-colors"
          title="View 30-Day Trial status & limits"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Trial (30 Days)</span>
        </Link>
        <div className="hidden md:flex items-center gap-2 rounded-[5px] border border-border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--teal)" }} />
          FY 2026–27
        </div>
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-2.5 rounded-full pl-1 pr-2.5 py-1 hover:bg-muted transition-colors outline-none"
          >
            <span
              className="h-8 w-8 rounded-full grid place-items-center text-white text-xs font-semibold"
              style={{ background: "var(--ink-3)" }}
            >
              {initials}
            </span>
            <span className="hidden lg:block text-left leading-tight">
              <span className="block text-[13px] font-medium">
                {user?.first_name} {user?.last_name}
              </span>
              <span className="block text-[11px] text-muted-foreground">{user?.user_email}</span>
            </span>
          </button>
          {open && (
            <div className="absolute right-0 mt-2 w-52 rounded-md border bg-popover text-popover-foreground shadow-lg p-1">
              <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user?.user_email}</div>
              <div className="my-1 h-px bg-muted" />
              <button
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                onClick={async () => {
                  await logout();
                  nav("/login");
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
