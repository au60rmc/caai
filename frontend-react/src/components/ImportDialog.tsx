import { useMemo, useRef, useState } from "react";
import { FileUp, ArrowRight, Download, CheckCircle2 } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult, getToken } from "../lib/api";
import { parseCSV, downloadCSV } from "../lib/csv";
import { useToast } from "./toast";
import { Button, Drawer, Select, Th, Td, TableWrap, Badge } from "./ui";
import { cn } from "../lib/format";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
}

/** Spec 8.2 import flow: upload -> auto-map columns -> validate -> preview ->
 *  confirm -> download error report if failed. */
export function ImportDialog({
  open,
  onClose,
  entity,
  entityLabel,
  fields,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  entity: string;
  entityLabel: string;
  fields: ImportField[];
  onImported: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  function reset() {
    setStep(1);
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
  }

  function close() {
    reset();
    onClose();
  }

  function autoMap(hdr: string[]) {
    const auto: Record<string, string> = {};
    for (const f of fields) {
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
      const hit = hdr.find(
        (h) => norm(h) === norm(f.key) || norm(h) === norm(f.label) || norm(h).includes(norm(f.key))
      );
      if (hit) auto[f.key] = hit;
    }
    setMapping(auto);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = /\.(xlsx|xlsm)$/i.test(file.name);
    if (isExcel) {
      // Excel is parsed server-side (openpyxl) via /import/upload.
      setBusy(true);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entity", entity);
      const tok = getToken();
      const res = await fetch("/api/import/upload", {
        method: "POST",
        headers: tok ? { Authorization: "Bearer " + tok } : {},
        body: fd,
      });
      setBusy(false);
      const data = await res.json().catch(() => null);
      if (!res.ok || data?.status === "ERROR") {
        toast({ title: "Could not read file", desc: data?.message || "Unsupported file", tone: "error" });
        return;
      }
      const parsed = data.result;
      const hdr: string[] = (parsed.columns || []).map((h: string) => String(h).trim());
      setHeaders(hdr);
      setRows((parsed.rows || []).map((row: Record<string, any>) => hdr.map((h) => String(row[h] ?? ""))));
      autoMap(hdr);
      setStep(2);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length < 2) {
      toast({ title: "File needs a header row and at least one data row", tone: "error" });
      return;
    }
    const hdr = parsed[0].map((h) => h.trim());
    setHeaders(hdr);
    setRows(parsed.slice(1));
    autoMap(hdr);
    setStep(2);
    if (fileRef.current) fileRef.current.value = "";
  }

  const mapped = useMemo(() => {
    return rows.map((r) => {
      const obj: Record<string, any> = {};
      for (const f of fields) {
        const col = mapping[f.key];
        if (col) {
          const idx = headers.indexOf(col);
          if (idx >= 0) obj[f.key] = (r[idx] ?? "").trim();
        }
      }
      return obj;
    });
  }, [rows, mapping, headers, fields]);

  const previewIssues = useMemo(
    () =>
      mapped.map((row) => {
        const missing = fields.filter((f) => f.required && !row[f.key]);
        return missing.length ? `Missing: ${missing.map((m) => m.label).join(", ")}` : null;
      }),
    [mapped, fields]
  );

  async function execute() {
    setBusy(true);
    const r = await api.post("/import/execute", { entity, rows: mapped });
    setBusy(false);
    if (!envelopeOk(r)) {
      toast({ title: "Import failed", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    const res = envelopeResult<any>(r);
    setResult(res);
    setStep(3);
    if (res.imported > 0) onImported();
  }

  function downloadErrors() {
    if (!result?.errors?.length) return;
    downloadCSV(
      `${entityLabel.toLowerCase()}-import-errors.csv`,
      ["row", "error", ...fields.map((f) => f.key)],
      result.errors.map((e: any) => [e.row, e.message, ...fields.map((f) => e.data?.[f.key] ?? "")])
    );
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      wide
      title={`Import ${entityLabel}`}
      desc="Upload CSV/Excel → map columns → validate & preview → confirm."
      footer={
        <>
          <Button variant="outline" onClick={close}>
            Close
          </Button>
          {step === 2 && (
            <Button onClick={execute} disabled={busy || mapped.length === 0}>
              <ArrowRight className="h-4 w-4 mr-1.5" />
              Import {mapped.length} rows
            </Button>
          )}
          {step === 3 && result?.failed > 0 && (
            <Button variant="secondary" onClick={downloadErrors}>
              <Download className="h-4 w-4 mr-1.5" />
              Download error report
            </Button>
          )}
        </>
      }
    >
      {/* step indicator */}
      <div className="flex items-center gap-2 mb-5">
        {["Upload", "Map & preview", "Result"].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "h-6 w-6 rounded-full grid place-items-center text-[11px] font-semibold",
                step > i ? "bg-[var(--teal)] text-white" : step === i + 1 ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-muted text-muted-foreground"
              )}
            >
              {i + 1}
            </span>
            <span className={cn("text-[12.5px]", step === i + 1 ? "font-semibold" : "text-muted-foreground")}>{s}</span>
            {i < 2 && <span className="w-8 h-px bg-border" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-border hover:border-[var(--teal)] transition-colors py-16 grid place-items-center text-center"
        >
          <FileUp className="h-8 w-8 text-muted-foreground mb-2 mx-auto" />
          <div className="font-medium">Choose a CSV or Excel (.xlsx) file</div>
          <div className="text-[12.5px] text-muted-foreground mt-1">
            Expected columns:{" "}
            <span className="mono">{fields.map((f) => f.key).join(", ")}</span>
          </div>
        </button>
      )}
      <input ref={fileRef} type="file" accept=".csv,text/csv,.xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={onFile} />

      {step === 2 && (
        <>
          <div className="eyebrow mb-2">Column mapping</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="text-xs font-medium text-muted-foreground">
                  {f.label}
                  {f.required && <span className="text-destructive ml-0.5">*</span>}
                </label>
                <Select
                  className="h-8 mt-1"
                  value={mapping[f.key] || ""}
                  onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                >
                  <option value="">— not mapped —</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <div className="eyebrow mb-2">Preview ({mapped.length} rows)</div>
          <TableWrap>
            <thead>
              <tr>
                <Th className="w-10">#</Th>
                {fields.map((f) => (
                  <Th key={f.key}>{f.label}</Th>
                ))}
                <Th>Check</Th>
              </tr>
            </thead>
            <tbody>
              {mapped.slice(0, 50).map((row, i) => (
                <tr key={i} className={previewIssues[i] ? "bg-[var(--red-soft)]/40" : undefined}>
                  <Td className="mono text-muted-foreground">{i + 1}</Td>
                  {fields.map((f) => (
                    <Td key={f.key}>{row[f.key] || <span className="text-muted-foreground">—</span>}</Td>
                  ))}
                  <Td>
                    {previewIssues[i] ? (
                      <Badge tone="bad">{previewIssues[i]}</Badge>
                    ) : (
                      <Badge tone="ok">Ready</Badge>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          {mapped.length > 50 && (
            <p className="text-[12px] text-muted-foreground mt-2">Showing first 50 of {mapped.length} rows.</p>
          )}
        </>
      )}

      {step === 3 && result && (
        <div className="text-center py-8">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--teal)" }} />
          <div className="text-lg font-semibold">
            {result.imported} imported · {result.failed} failed
          </div>
          {result.failed > 0 && (
            <div className="mt-4 max-w-md mx-auto text-left rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
              {result.errors.slice(0, 8).map((e: any, i: number) => (
                <div key={i} className="text-[12.5px]">
                  <span className="mono text-muted-foreground">Row {e.row}:</span>{" "}
                  <span className="hint-error">{e.message}</span>
                </div>
              ))}
              {result.errors.length > 8 && (
                <div className="text-[12px] text-muted-foreground">…and {result.errors.length - 8} more (download the report).</div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
