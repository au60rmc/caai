import { useState } from "react";
import {
  HelpCircle,
  RefreshCw,
  Sparkles,
  Download,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  BookOpen,
  Keyboard,
  HardDrive,
  Laptop,
  Database,
} from "lucide-react";
import { api } from "../lib/api";
import { Button } from "../components/ui";
import { useUpdateCheck, UpdateModal } from "../components/UpdateManager";

export function Help() {
  const { info, checking, check } = useUpdateCheck();
  const [updating, setUpdating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  async function handleApplyUpdate() {
    setUpdating(true);
    setProgress(20);
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
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-foreground">
            <HelpCircle className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Help & Software Updates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Check for new releases, view system version details, and access user guides.
          </p>
        </div>
        <Button
          onClick={() => check(true)}
          disabled={checking || updating}
          className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking GitHub..." : "Check for Updates"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Updates & System Status */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Updates Card */}
          <div className="bg-card border border-teal-500/30 rounded-xl shadow-xs overflow-hidden">
            <div className="bg-teal-50/50 dark:bg-teal-950/20 border-b border-border/60 px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Software Updates
              </h3>
              <span className="px-2.5 py-0.5 rounded-full border border-border bg-background text-xs font-mono font-medium">
                v{info?.current_version || "2.0.2"}
              </span>
            </div>
            <div className="p-6 space-y-4">
              {info?.update_available ? (
                <div className="p-4 rounded-xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-cyan-500/10 border border-teal-500/30 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-sm text-teal-900 dark:text-teal-100 flex items-center gap-2">
                        🚀 New Update Available!
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {info.commit_message || "New accounting features and bug fixes ready to install."}
                      </p>
                      {info.commit_date && (
                        <p className="text-[11px] text-muted-foreground/80 mt-0.5">
                          Released: {new Date(info.commit_date).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Button
                      onClick={handleApplyUpdate}
                      disabled={updating}
                      size="sm"
                      className="bg-teal-600 hover:bg-teal-700 text-white shrink-0 cursor-pointer shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Update Now
                    </Button>
                  </div>
                </div>
              ) : info?.offline ? (
                <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-center gap-3 text-xs text-muted-foreground">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Offline Mode:</strong> Connect your computer to Wi-Fi to check for newly published updates from GitHub. ImmBiz Books continues to run 100% offline.
                  </span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-xs text-emerald-800 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    You are on the latest version of ImmBiz Books (<strong>v{info?.current_version || "2.0.2"}</strong>). No updates needed.
                  </span>
                </div>
              )}

              {/* Version metadata details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Version</span>
                  <span className="font-mono font-medium text-foreground">{info?.current_version || "2.0.2"}</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Update Channel</span>
                  <span className="font-medium text-foreground">Stable (Official)</span>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/50 col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Commit Hash</span>
                  <span className="font-mono text-muted-foreground truncate block">{info?.current_hash || "latest"}</span>
                </div>
              </div>

              {/* Data Safety Assurance */}
              <div className="text-[11px] text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border/50 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <strong>Zero Data Loss Guarantee:</strong> All update downloads strictly preserve your offline SQLite database (<code>backend/immbiz.db</code>), companies, vouchers, and ledger accounts.
                </div>
              </div>
            </div>
          </div>

          {/* User Guide & Modules Card */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="border-b border-border/50 px-5 py-3.5">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <BookOpen className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Accounting User Guides
              </h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 rounded-lg border border-border/60 hover:border-teal-500/40 transition-colors">
                  <div className="font-semibold text-foreground mb-1">🏢 Multi-Company Master</div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Set up business profiles, GSTIN, PAN, and define Financial Year bounds. Easily switch companies from the top header anytime.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border/60 hover:border-teal-500/40 transition-colors">
                  <div className="font-semibold text-foreground mb-1">📑 Chart of Accounts & Ledgers</div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Hierarchical grouping (Assets, Liabilities, Incomes, Expenses). Configure credit limits, GST classifications, and opening balances.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border/60 hover:border-teal-500/40 transition-colors">
                  <div className="font-semibold text-foreground mb-1">🧾 Voucher Entry & Numbering</div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Create Journal, Payment, Receipt, Contra, Sales, and Purchase vouchers. Automated sequence numbering and debit/credit validation.
                  </p>
                </div>
                <div className="p-3.5 rounded-lg border border-border/60 hover:border-teal-500/40 transition-colors">
                  <div className="font-semibold text-foreground mb-1">📊 Financial Reports</div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    Generate Trial Balance, Profit & Loss Statements, Balance Sheets, and Cash Book ledgers in real time with export capabilities.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Keyboard Shortcuts & System Specs */}
        <div className="space-y-6">
          {/* Keyboard Shortcuts */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="border-b border-border/50 px-5 py-3.5">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Keyboard className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                Keyboard Shortcuts
              </h3>
            </div>
            <div className="p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground">New Record / Voucher</span>
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-[11px] border border-border">Ctrl + N</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground">Save / Save Draft</span>
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-[11px] border border-border">Ctrl + S</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                <span className="text-muted-foreground">Close Drawer / Modal</span>
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-[11px] border border-border">Esc</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Check for Updates</span>
                <kbd className="px-2 py-0.5 rounded bg-muted font-mono text-[11px] border border-border">Click Top Right</kbd>
              </div>
            </div>
          </div>

          {/* System Environment */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            <div className="border-b border-border/50 px-5 py-3.5">
              <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
                <Laptop className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                System Environment
              </h3>
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  Database
                </span>
                <span className="font-mono font-medium">SQLite 3 (Embedded)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                  Backend Port
                </span>
                <span className="font-mono font-medium">8000</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Frontend Bundle</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">Pre-compiled SPA</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Offline Support</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">100% Offline</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress / Status Modal during update */}
      <UpdateModal
        open={updating}
        progress={progress}
        statusText={statusText}
        isDone={isDone}
        errorText={errorText}
        onClose={() => setUpdating(false)}
      />
    </div>
  );
}
export default Help;
