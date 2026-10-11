import { Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useCompany } from "../auth/CompanyContext";
import { useUpdateCheck, UpdateBanner, UpdateModal } from "./UpdateManager";
import { api, envelopeOk } from "../lib/api";

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

  const { info, dismissed, dismiss } = useUpdateCheck();
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleApplyUpdate() {
    setModalOpen(true);
    setProgress(15);
    setStatusText("Connecting to update server...");
    setErrorText(null);

    const intv = setInterval(() => {
      setProgress((p) => (p < 85 ? p + Math.floor(Math.random() * 12 + 5) : p));
    }, 400);

    try {
      setStatusText("Downloading code bundle from GitHub...");
      const res = await api.post("/system/apply-update");
      clearInterval(intv);

      if (res.ok) {
        setProgress(100);
        setIsDone(true);
        setStatusText("Update applied successfully! Restarting ImmBiz Books in 3 seconds...");
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(res.data?.detail || "Update could not be applied.");
      }
    } catch (err: any) {
      clearInterval(intv);
      setErrorText(err?.message || "Failed to download update. Please try again.");
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <UpdateBanner
          info={info}
          dismissed={dismissed}
          onDismiss={dismiss}
          onApply={handleApplyUpdate}
        />
        <Topbar title={title} />
        <main className="flex-1" key={companyId || "no-company"}>
          <Outlet />
        </main>
        <footer className="px-6 lg:px-8 py-4 text-[11px] text-muted-foreground border-t border-border flex flex-wrap items-center justify-between gap-2">
          <span>ImmBiz Books · CAAI FA Masters · FY 2026–27</span>
          <span className="mono">Ctrl+K search · Ctrl+N new · Ctrl+S save · All figures in INR</span>
        </footer>

        <UpdateModal
          open={modalOpen}
          progress={progress}
          statusText={statusText}
          isDone={isDone}
          errorText={errorText}
          onClose={() => setModalOpen(false)}
        />
      </div>
    </div>
  );
}
