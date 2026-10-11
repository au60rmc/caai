import { useEffect, useRef, useState } from "react";
import { Plus, Download, Upload, RefreshCw, CheckCircle2, Sparkles, ShieldCheck, Laptop } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult, getToken } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { Button, Input, PageHeader, Panel, Spinner, Td, Th, TableWrap, EmptyRow, Badge } from "../components/ui";
import { useUpdateCheck, UpdateModal } from "../components/UpdateManager";

interface Setting {
  id?: string;
  keyName: string;
  keyValue: string;
  keyType?: string;
  sysModule?: string;
  active?: string;
}
interface Seq {
  id: string;
  voucherType: string;
  prefix: string;
  lastNumber: number;
  numberWidth: number;
}

export function SystemSettings() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("SYSTEM_SETTING", "write");

  const [tab, setTab] = useState<"sys" | "seq" | "about">("sys");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [seqs, setSeqs] = useState<Seq[]>([]);
  const [loading, setLoading] = useState(true);
  const restoreRef = useRef<HTMLInputElement>(null);

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

  async function load() {
    setLoading(true);
    const [sr, qr] = await Promise.all([api.get("/systemSettings/fetchSystemSettings"), api.get("/voucher-sequences")]);
    setSettings(envelopeResult<Setting[]>(sr) || []);
    setSeqs(envelopeResult<Seq[]>(qr) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function addSetting() {
    setSettings((s) => [...s, { keyName: "", keyValue: "", keyType: "S", sysModule: "MODULE_SYS", active: "Y" }]);
  }
  function updateSetting(i: number, patch: Partial<Setting>) {
    setSettings((s) => s.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }

  async function saveSettings() {
    for (const s of settings) {
      if (!s.keyName.trim()) {
        toast({ title: "Every setting needs a key name", tone: "error" });
        return;
      }
    }
    const r = await api.post("/systemSettings/saveSystemSettings", settings);
    if (!envelopeOk(r)) return toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
    toast({ title: "Settings saved", tone: "success" });
    load();
  }

  async function saveSeqs() {
    for (const s of seqs) {
      if (!s.prefix.trim() || !s.numberWidth) {
        toast({ title: "Prefix and width are required", tone: "error" });
        return;
      }
    }
    const r = await api.post("/voucher-sequences/bulk-save", seqs);
    if (!envelopeOk(r)) return toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
    toast({ title: "Sequences saved", tone: "success" });
    load();
  }

  async function backup() {
    try {
      const res = await fetch("/api/system/backup", {
        headers: { Authorization: "Bearer " + (getToken() || "") },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `immbiz-backup-${new Date().toISOString().slice(0, 10)}.db`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", tone: "success" });
    } catch {
      toast({ title: "Backup failed", tone: "error" });
    }
  }

  async function restore(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/system/restore", {
        method: "POST",
        headers: { Authorization: "Bearer " + (getToken() || "") },
        body: fd,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.detail);
      toast({ title: "Restore staged", desc: d?.message || "Restart the app to apply.", tone: "success" });
    } catch (err: any) {
      toast({ title: "Restore failed", desc: err?.message || "", tone: "error" });
    } finally {
      if (restoreRef.current) restoreRef.current.value = "";
    }
  }

  return (
    <PageHeader
      title="System Settings"
      sub="Organisation-wide configuration, voucher numbering, period lock (BOOKS_LOCKED_UPTO) and backups"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={backup}>
            <Download className="h-4 w-4 mr-1.5" />
            Backup
          </Button>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => restoreRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" />
              Restore
            </Button>
          )}
          <input ref={restoreRef} type="file" accept=".db,application/octet-stream" className="hidden" onChange={restore} />
        </div>
      }
    >
      <Panel pad={false} title="Configuration">
        <div className="px-5 pt-3 flex items-center gap-2">
          {(["sys", "seq", "about"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-3 py-1.5 rounded-md text-sm font-medium " +
                (tab === t ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")
              }
            >
              {t === "sys" ? "Settings" : t === "seq" ? "Voucher numbering" : "About & Updates"}
            </button>
          ))}
          {tab === "sys" && canWrite && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={addSetting}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add setting
            </Button>
          )}
        </div>

        <div className="p-5 pt-3">
          {loading ? (
            <Spinner />
          ) : tab === "sys" ? (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th className="w-1/2">Key</Th>
                    <Th>Value</Th>
                  </tr>
                </thead>
                <tbody>
                  {settings.length === 0 && <EmptyRow colSpan={2} text="No settings yet. Add one." />}
                  {settings.map((s, i) => (
                    <tr key={s.id || i} className="hover:bg-muted/30">
                      <Td>
                        {s.id ? (
                          <span className="mono text-muted-foreground">{s.keyName}</span>
                        ) : (
                          <Input className="h-8 mono" placeholder="KEY_NAME" value={s.keyName} onChange={(e) => updateSetting(i, { keyName: e.target.value })} />
                        )}
                      </Td>
                      <Td>
                        <Input className="h-8 mono max-w-md" disabled={!canWrite} value={s.keyValue} onChange={(e) => updateSetting(i, { keyValue: e.target.value })} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {canWrite && (
                <div className="flex justify-end mt-4">
                  <Button size="sm" onClick={saveSettings}>
                    Save settings
                  </Button>
                </div>
              )}
            </>
          ) : tab === "seq" ? (
            <>
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Voucher type</Th>
                    <Th className="w-32">Prefix</Th>
                    <Th right className="w-32">
                      Last number
                    </Th>
                    <Th right className="w-28">
                      Width
                    </Th>
                    <Th>Next number</Th>
                  </tr>
                </thead>
                <tbody>
                  {seqs.length === 0 && <EmptyRow colSpan={5} />}
                  {seqs.map((s, i) => (
                    <tr key={s.id} className="hover:bg-muted/30">
                      <Td className="font-medium">{s.voucherType}</Td>
                      <Td>
                        <Input
                          className="h-8 mono w-24"
                          disabled={!canWrite}
                          value={s.prefix}
                          onChange={(e) => setSeqs((q) => q.map((x, idx) => (idx === i ? { ...x, prefix: e.target.value } : x)))}
                        />
                      </Td>
                      <Td right className="fig">{s.lastNumber}</Td>
                      <Td right>
                        <Input
                          type="number"
                          className="h-8 w-20 text-right ml-auto"
                          disabled={!canWrite}
                          value={s.numberWidth}
                          onChange={(e) => setSeqs((q) => q.map((x, idx) => (idx === i ? { ...x, numberWidth: +e.target.value || 0 } : x)))}
                        />
                      </Td>
                      <Td className="mono text-[var(--teal)]">
                        {s.prefix}
                        {String(s.lastNumber + 1).padStart(s.numberWidth, "0")}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
              {canWrite && (
                <div className="flex justify-end mt-4">
                  <Button size="sm" onClick={saveSeqs}>
                    Save sequences
                  </Button>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-6 max-w-2xl py-2">
              <div className="flex items-start gap-4 p-5 rounded-xl border border-border bg-card/60">
                <span className="h-12 w-12 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center shrink-0">
                  <Laptop className="h-6 w-6" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-lg">ImmBiz Books</h3>
                    <Badge tone="ok">v{info?.current_version || "2.0.1"}</Badge>
                    <Badge tone="ok">Offline Edition</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    CAAI Financial Accounting Masters Platform with offline embedded SQLite database.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
                    <div className="p-2.5 rounded bg-muted/40 border border-border/50">
                      <span className="text-muted-foreground block text-[10px] uppercase font-sans font-semibold">Active Database</span>
                      <span>SQLite (immbiz.db)</span>
                    </div>
                    <div className="p-2.5 rounded bg-muted/40 border border-border/50">
                      <span className="text-muted-foreground block text-[10px] uppercase font-sans font-semibold">Update Channel</span>
                      <span>GitHub ({info?.channel || "stable"})</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-xl border border-border bg-card/60 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-sm">Software Updates</h4>
                    <p className="text-xs text-muted-foreground">
                      Check for new features, bug fixes, and improvements directly from GitHub.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={checking}
                    onClick={() => check(true)}
                    className="shrink-0"
                  >
                    <RefreshCw className={"h-3.5 w-3.5 mr-1.5 " + (checking ? "animate-spin" : "")} />
                    {checking ? "Checking..." : "Check for Updates"}
                  </Button>
                </div>

                {info?.update_available ? (
                  <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/30 space-y-3">
                    <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium text-sm">
                      <Sparkles className="h-4 w-4" />
                      <span>New Version Available ({info.latest_hash || "latest"})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {info.commit_message || "New updates are ready to install."}
                    </p>
                    <Button size="sm" onClick={handleApplyUpdate} className="bg-teal-600 hover:bg-teal-700 text-white">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Update Now
                    </Button>
                  </div>
                ) : info?.offline ? (
                  <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                    <span>📡 Offline: Connect to Wi-Fi to check for newly published updates.</span>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>You are on the latest version ({info?.current_version || "v2.0.1"}). No updates needed.</span>
                  </div>
                )}

                <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Zero Data Loss: Your offline database (immbiz.db) is preserved safely during all updates.</span>
                </div>
              </div>

              <UpdateModal
                open={updating}
                progress={progress}
                statusText={statusText}
                isDone={isDone}
                errorText={errorText}
                onClose={() => setUpdating(false)}
              />
            </div>
          )}
        </div>
      </Panel>
    </PageHeader>
  );
}
