import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useCompany } from "../auth/CompanyContext";

const TITLES: Record<string, string> = {
  dashboard: "Masters Dashboard",
  companies: "Company Master",
  ledgers: "Ledgers",
  "ledger-groups": "Ledger Groups",
  customers: "Customers",
  vendors: "Vendors",
  products: "Products & Services",
  banks: "Bank & Cash",
  gst: "GST Setup",
  "cost-centers": "Cost Centers",
  units: "Units",
  "voucher-types": "Voucher Types",
  "accounting-vouchers": "Accounting Voucher",
  journal: "Journal Vouchers",
  users: "Users",
  roles: "Roles & Permissions",
  settings: "System Settings",
  lov: "List of Values",
  "custom-fields": "Custom Fields",
};

export function AppLayout() {
  const loc = useLocation();
  const { companyId } = useCompany();
  const seg = loc.pathname.split("/").filter(Boolean).pop() || "dashboard";
  const title = TITLES[seg] || "ImmBiz Books";

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar title={title} />
        <main className="flex-1" key={companyId || "no-company"}>
          <Outlet />
        </main>
        <footer className="px-6 lg:px-8 py-4 text-[11px] text-muted-foreground border-t border-border flex flex-wrap items-center justify-between gap-2">
          <span>ImmBiz Books · CAAI FA Masters · FY 2026–27</span>
          <span className="mono">Ctrl+K search · Ctrl+N new · Ctrl+S save · All figures in INR</span>
        </footer>
      </div>
    </div>
  );
}
