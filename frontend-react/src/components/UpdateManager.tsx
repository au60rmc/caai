import { useEffect, useState } from "react";
import { Sparkles, Download, CheckCircle2, RefreshCw, X, AlertCircle } from "lucide-react";
import { api, envelopeOk, envelopeResult } from "../lib/api";
import { useToast } from "./toast";
import { Button, Spinner } from "./ui";

export interface UpdateInfo {
  update_available: boolean;
  offline?: boolean;
  current_version?: string;
  current_hash?: string;
  latest_hash?: string;
  commit_message?: string;
  commit_date?: string;
  channel?: string;
}

export function useUpdateCheck() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("immbiz_update_dismissed") === "true");
  const { toast } = useToast();

  async function check(manual = false) {
    if (checking) return;
    setChecking(true);
    try {
      const res = await api.get("/system/check-update");
      const data = res.data as UpdateInfo;
      setInfo(data);

      // If a new commit arrived that was not dismissed, ensure banner shows
      const dismissedHash = sessionStorage.getItem("immbiz_update_dismissed_hash");
      if (data?.update_available && data?.latest_hash && data.latest_hash !== dismissedHash) {
        setDismissed(false);
      }

      if (manual) {
        if (data?.update_available) {
          toast({
            title: "Update Available!",
            desc: data.commit_message || "A new version of ImmBiz Books is ready to install.",
            tone: "success",
          });
        } else if (data?.offline) {
          toast({
            title: "Offline",
            desc: "Cannot connect to update server. Please check your Wi-Fi.",
            tone: "info",
          });
        } else {
          toast({
            title: "Up to Date",
            desc: `You are on the latest version (${data?.current_version || "v2.0.2"}).`,
            tone: "info",
          });
        }
      }
    } catch {
      if (manual) {
        toast({ title: "Check Failed", desc: "Unable to check for updates right now.", tone: "error" });
      }
    } finally {
      setChecking(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    if (info?.latest_hash) {
      sessionStorage.setItem("immbiz_update_dismissed_hash", info.latest_hash);
    }
  }

  useEffect(() => {
    // Check quietly 1.5 seconds after app mounts
    const t = setTimeout(() => {
      check(false);
    }, 1500);

    // Periodically re-check every 30 seconds so pushed updates appear automatically without refresh
    const interval = setInterval(() => {
      check(false);
    }, 30000);

    // Automatically check when user switches back to this browser tab
    function onFocus() {
      check(false);
    }
    window.addEventListener("focus", onFocus);

    return () => {
      clearTimeout(t);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return { info, checking, dismissed, check, dismiss };
}

export function UpdateBanner({
  info,
  dismissed,
  onDismiss,
  onApply,
}: {
  info: UpdateInfo | null;
  dismissed: boolean;
  onDismiss: () => void;
  onApply: () => void;
}) {
  if (!info || !info.update_available || dismissed) return null;

  return (
    <aside aria-label="Update notification" className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 text-white px-4 py-2.5 shadow-md flex items-center justify-between gap-4 text-xs z-50">
      <div className="flex items-center gap-3 min-w-0">
        <span className="h-7 w-7 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4 text-yellow-300" />
        </span>
        <div className="truncate">
          <span className="font-semibold text-white">🚀 New Update Available</span>
          <span className="opacity-90 ml-1.5 hidden sm:inline">
            ({info.commit_message || "New accounting features and improvements ready"})
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onApply}
          className="bg-white text-teal-800 hover:bg-white/90 font-medium px-3 py-1 rounded shadow-sm text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="h-3.5 w-3.5" />
          Update Now
        </button>
        <button
          onClick={onDismiss}
          className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-1 rounded text-xs transition-colors cursor-pointer"
          title="Remind me later"
        >
          Remind Later
        </button>
      </div>
    </aside>
  );
}

export function UpdateModal({
  open,
  progress,
  statusText,
  isDone,
  errorText,
  onClose,
}: {
  open: boolean;
  progress: number;
  statusText: string;
  isDone: boolean;
  errorText?: string | null;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 rounded-full bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
            {isDone ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : errorText ? <AlertCircle className="h-5 w-5 text-red-500" /> : <RefreshCw className="h-5 w-5 animate-spin text-teal-600" />}
          </span>
          <div>
            <h3 className="font-semibold text-base">
              {isDone ? "Update Completed!" : errorText ? "Update Encountered an Issue" : "Updating ImmBiz Books"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {errorText ? errorText : statusText}
            </p>
          </div>
        </div>

        {!errorText && (
          <div className="space-y-1.5 pt-2">
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-600 h-full transition-all duration-300 ease-out rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
              <span>{isDone ? "Installed" : "Downloading bundle..."}</span>
              <span>{progress}%</span>
            </div>
          </div>
        )}

        <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded border border-border/50">
          🛡️ <strong>Zero Data Loss Guarantee:</strong> Your local database (<code>immbiz.db</code>), companies, vouchers, and ledgers remain completely safe and untouched.
        </div>

        {errorText && (
          <div className="flex justify-end pt-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
