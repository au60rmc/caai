import { useEffect, useRef, useState } from "react";
import { Plus, Download, Upload } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult, getToken } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { Button, Input, PageHeader, Panel, Spinner, Td, Th, TableWrap, EmptyRow } from "../components/ui";

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

  const [tab, setTab] = useState<"sys" | "seq">("sys");
  const [settings, setSettings] = useState<Setting[]>([]);
  const [seqs, setSeqs] = useState<Seq[]>([]);
  const [loading, setLoading] = useState(true);
  const restoreRef = useRef<HTMLInputElement>(null);

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
          {(["sys", "seq"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-3 py-1.5 rounded-md text-sm font-medium " +
                (tab === t ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")
              }
            >
              {t === "sys" ? "Settings" : "Voucher numbering"}
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
          ) : (
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
          )}
        </div>
      </Panel>
    </PageHeader>
  );
}
