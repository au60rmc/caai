import { useRef, useState } from "react";
import { Sparkles, Upload, Loader2, CheckCircle2, AlertTriangle, Scale } from "lucide-react";
import { Button, Badge, Select, TableWrap, Th, Td } from "./ui";
import { getToken, getActiveCompanyId, envelopeResult } from "../lib/api";
import { money } from "../lib/format";
import { useToast } from "./toast";

export interface AiLine {
  description: string;
  hsn: string;
  qty: number;
  unit?: string;
  rate: number;
  discount?: number;
  gst_rate: number;
  amount?: number;
}

export interface AiCandidate {
  party_id: string;
  ledger_id: string | null;
  name: string;
  gstin: string | null;
  match: string;
  score: number;
}

export interface AiDraft {
  doc_type: string;
  confidence: number;
  confidence_breakdown?: Record<string, number>;
  degraded?: boolean;
  fields: {
    invoice_no: string;
    irn?: string;
    invoice_date: string;
    due_date: string;
    seller_gstin: string;
    buyer_gstin: string;
    seller_state?: string;
    buyer_state?: string;
    place_of_supply: string;
    inter_state: boolean;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    discount_total?: number;
    round_off?: number;
    grand_total: number;
    narration: string;
    seller_name_hint: string;
    buyer_name_hint: string;
  };
  lines: AiLine[];
  totals_check?: {
    scanned_taxable: number;
    scanned_tax: number;
    scanned_grand: number;
    computed_taxable: number;
    computed_tax: number;
    reconciled: boolean;
    diff: number | null;
  };
  candidates?: AiCandidate[];
  warnings: string[];
  tier_used?: string;
}

export interface AiBatchFile {
  filename: string;
  ok: boolean;
  error?: string;
  doc_type?: string;
  confidence?: number;
  confidence_breakdown?: Record<string, number>;
  degraded?: boolean;
  fields?: AiDraft["fields"];
  lines?: AiLine[];
  totals_check?: AiDraft["totals_check"];
  candidates?: AiCandidate[];
  warnings?: string[];
  tier_used?: string;
}

export function AiModeButton({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      title="Fill this form from a scanned bill/invoice with Docling AI"
    >
      <Sparkles className="h-4 w-4 mr-1.5" />
      AI Mode {active ? "ON" : "OFF"}
    </Button>
  );
}

export function AiFillPanel({
  target,
  onApply,
  liveGrandTotal,
  liveTaxable,
}: {
  target: string;
  onApply: (draft: AiDraft) => void;
  /** Live form grand total (recomputed as the user edits) for reconciliation. */
  liveGrandTotal?: number | null;
  liveTaxable?: number | null;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [tier, setTier] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [applied, setApplied] = useState(false);
  const [batch, setBatch] = useState<AiBatchFile[] | null>(null);
  const [batchSummary, setBatchSummary] = useState("");
  const [appliedFiles, setAppliedFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function postDoc(path: string, f: File) {
    const fd = new FormData();
    fd.append("file", f);
    const headers: Record<string, string> = {};
    const tok = getToken();
    if (tok) headers["Authorization"] = "Bearer " + tok;
    const cid = getActiveCompanyId();
    if (cid) headers["X-Company-Id"] = cid;
    return fetch(path, { method: "POST", headers, body: fd });
  }

  function applyDraft(d: AiDraft, sourceName?: string) {
    onApply(d);
    setDraft(d);
    setApplied(true);
    if (sourceName) setAppliedFiles((s) => (s.includes(sourceName) ? s : [...s, sourceName]));
    toast({ title: "Form filled from document — verify & save", tone: "success" });
  }

  async function handleFile(f: File | undefined) {
    if (!f) return;
    const isZip = f.name.toLowerCase().endsWith(".zip");
    setBusy(true);
    setError(null);
    setDraft(null);
    setBatch(null);
    setBatchSummary("");
    setApplied(false);
    setAppliedFiles([]);
    try {
      if (isZip) {
        const res = await postDoc(
          `/api/documents/parse-batch?target=${encodeURIComponent(target)}&tier=${encodeURIComponent(tier)}`,
          f
        );
        const data = await res.json();
        const result = envelopeResult<{ files: AiBatchFile[]; succeeded: number; failed: number }>({
          ok: res.ok,
          status: res.status,
          data,
        } as any);
        if (!res.ok || (data && data.status === "ERROR") || !result) {
          throw new Error(data?.message || data?.detail || `Batch failed (${res.status})`);
        }
        setBatch(result.files || []);
        setBatchSummary(`${result.succeeded} ok, ${result.failed} failed — Apply each, then Save draft per voucher.`);
      } else {
        const res = await postDoc(
          `/api/documents/parse?target=${encodeURIComponent(target)}&tier=${encodeURIComponent(tier)}`,
          f
        );
        const data = await res.json();
        const result = envelopeResult<AiDraft>({ ok: res.ok, status: res.status, data } as any);
        if (!res.ok || (data && data.status === "ERROR") || !result) {
          throw new Error(data?.message || data?.detail || `Parse failed (${res.status})`);
        }
        setDraft(result);
        if (!result.lines?.length) {
          toast({ title: "Parsed with low detail — review before applying", tone: "info" });
        }
      }
    } catch (e: any) {
      setError(e?.message || "Could not parse file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-[var(--teal)] bg-[var(--teal-soft)]/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.tiff,.docx,.xlsx,.csv,.zip"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <Button type="button" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
          {busy ? "Parsing with Docling…" : "Upload bill / invoice / ZIP"}
        </Button>
        <Select value={tier} onChange={(e) => setTier(e.target.value)} className="w-36" aria-label="Docling tier">
          <option value="auto">Auto tier</option>
          <option value="low">Low-spec (fast)</option>
          <option value="high">High-spec (OCR)</option>
        </Select>
        {draft && (
          <Badge tone={draft.confidence >= 70 ? "ok" : draft.confidence >= 40 ? "warn" : "bad"}>
            {draft.confidence}% confident · {draft.tier_used || ""}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Pure Docling, works offline. Single bill (PDF/image/Excel) or a ZIP of up to 20 bills →
        Apply fills this form, one voucher at a time. You always review before Save.
      </p>
      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> {error}
        </p>
      )}
      {batch && (
        <div className="rounded-md bg-background border border-border p-3 space-y-2 text-[13px]">
          <p className="text-xs text-muted-foreground">{batchSummary}</p>
          {batch.map((b) => (
            <div key={b.filename} className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-2">
              <span className="mono font-medium truncate max-w-[220px]" title={b.filename}>
                {b.filename}
              </span>
              {b.ok ? (
                <>
                  <Badge tone={(b.confidence || 0) >= 70 ? "ok" : (b.confidence || 0) >= 40 ? "warn" : "bad"}>
                    {b.confidence}% · {b.fields ? money(b.fields.grand_total) : ""}
                  </Badge>
                  {b.degraded && <Badge tone="warn">Stepped down</Badge>}
                  {appliedFiles.includes(b.filename) && <Badge tone="ok">Applied ✓</Badge>}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      b.fields &&
                      applyDraft(
                        {
                          doc_type: b.doc_type || "UNKNOWN",
                          confidence: b.confidence || 0,
                          confidence_breakdown: b.confidence_breakdown,
                          degraded: b.degraded,
                          fields: b.fields,
                          lines: b.lines || [],
                          totals_check: b.totals_check,
                          candidates: b.candidates,
                          warnings: b.warnings || [],
                          tier_used: b.tier_used,
                        },
                        b.filename
                      )
                    }
                  >
                    Apply
                  </Button>
                </>
              ) : (
                <span className="text-xs text-destructive">{b.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {draft && (
        <AiExtractView
          draft={draft}
          applied={applied}
          liveGrandTotal={liveGrandTotal}
          liveTaxable={liveTaxable}
          onApply={() => applyDraft(draft)}
        />
      )}
    </div>
  );
}

function FieldCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className={`text-[13px] font-medium truncate ${mono ? "mono" : ""}`} title={value || "—"}>
        {value || "—"}
      </div>
    </div>
  );
}

function AiExtractView({
  draft,
  applied,
  liveGrandTotal,
  liveTaxable,
  onApply,
}: {
  draft: AiDraft;
  applied: boolean;
  liveGrandTotal?: number | null;
  liveTaxable?: number | null;
  onApply: () => void;
}) {
  const f = draft.fields;
  const scanned = Number(f.grand_total) || 0;
  const live = liveGrandTotal ?? null;
  const diff = live != null ? Math.round((live - scanned) * 100) / 100 : null;
  const matched = diff != null && Math.abs(diff) < 0.01;
  const scannedTaxable = Number(f.taxable) || 0;
  const liveTx = liveTaxable ?? null;
  const txDiff = liveTx != null ? Math.round((liveTx - scannedTaxable) * 100) / 100 : null;
  const txMatched = txDiff != null && Math.abs(txDiff) < 0.01;
  const tc = draft.totals_check;
  const breakdown = draft.confidence_breakdown
    ? Object.entries(draft.confidence_breakdown)
    : [];

  return (
    <div className="rounded-md bg-background border border-border p-3 space-y-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={draft.confidence >= 70 ? "ok" : draft.confidence >= 40 ? "warn" : "bad"}>
          {draft.confidence}% confident
        </Badge>
        <span className="text-xs text-muted-foreground">
          {draft.doc_type || "UNKNOWN"} · {draft.tier_used || ""}
        </span>
        {draft.degraded && <Badge tone="warn">Stepped down tier — verify closely</Badge>}
        {applied && <Badge tone="ok">Applied ✓</Badge>}
      </div>

      {breakdown.length > 0 && (
        <p className="text-[11px] text-muted-foreground" title="Weighted confidence signals">
          Why {draft.confidence}%: {breakdown.map(([k, v]) => `${k} ${v}`).join(" · ")}
        </p>
      )}

      {/* Every extracted field */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
        <FieldCell label="Invoice no" value={f.invoice_no} mono />
        <FieldCell label="Invoice date" value={f.invoice_date} mono />
        <FieldCell label="Seller GSTIN" value={f.seller_gstin} mono />
        <FieldCell label="Buyer GSTIN" value={f.buyer_gstin} mono />
        <FieldCell label="Seller" value={f.seller_name_hint} />
        <FieldCell label="Buyer" value={f.buyer_name_hint} />
        <FieldCell label="Seller state" value={f.seller_state || ""} />
        <FieldCell label="Buyer state" value={f.buyer_state || ""} />
        <FieldCell label="Place of supply" value={f.place_of_supply} />
        <FieldCell label="Inter-state" value={f.inter_state ? "Yes (IGST)" : "No (CGST+SGST)"} />
        <FieldCell label="Taxable" value={f.taxable ? money(f.taxable) : ""} mono />
        <FieldCell label="CGST" value={f.cgst ? money(f.cgst) : ""} mono />
        <FieldCell label="SGST" value={f.sgst ? money(f.sgst) : ""} mono />
        <FieldCell label="IGST" value={f.igst ? money(f.igst) : ""} mono />
        <FieldCell label="Discount" value={f.discount_total ? money(f.discount_total) : ""} mono />
        <FieldCell label="Round off" value={f.round_off ? money(f.round_off) : ""} mono />
      </div>

      {/* Server-side party candidates */}
      {draft.candidates && draft.candidates.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Matched from your masters
          </div>
          {draft.candidates.map((c) => (
            <div key={c.party_id} className="flex flex-wrap items-center gap-2 text-[13px]">
              <Badge tone={c.score >= 80 ? "ok" : "warn"}>
                {c.match === "gstin_exact" ? "GSTIN ✓" : c.match === "name_exact" ? "Name ✓" : `Fuzzy ${c.score}`}
              </Badge>
              <span className="font-medium">{c.name}</span>
              {c.gstin && <span className="mono text-xs text-muted-foreground">{c.gstin}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Extracted line items */}
      {draft.lines.length > 0 && (
        <TableWrap>
          <thead>
            <tr>
              <Th className="w-8">#</Th>
              <Th>Description</Th>
              <Th>HSN</Th>
              <Th right>Qty</Th>
              <Th right>Rate</Th>
              <Th right>GST%</Th>
              <Th right>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {draft.lines.map((l, i) => (
              <tr key={i}>
                <Td className="mono text-muted-foreground">{i + 1}</Td>
                <Td className="max-w-[220px] truncate" >{l.description || "—"}</Td>
                <Td className="mono">{l.hsn || "—"}</Td>
                <Td right className="mono">{l.qty}{l.unit ? ` ${l.unit}` : ""}</Td>
                <Td right className="mono">{money(l.rate)}</Td>
                <Td right className="mono">{l.gst_rate}%</Td>
                <Td right className="mono">{money(l.amount ?? Math.round((Number(l.qty) || 0) * (Number(l.rate) || 0) * 100) / 100)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {draft.warnings.map((w, i) => (
        <p key={i} className="flex items-center gap-1.5 text-xs text-[#8A6420]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {w}
        </p>
      ))}

      {/* Scan cross-check: does the document agree with itself? */}
      {tc && (
        <div
          className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border px-3 py-2 text-[13px] ${
            tc.reconciled ? "border-border bg-muted/30" : "border-destructive/50 bg-destructive/5"
          }`}
        >
          <span className="text-xs text-muted-foreground">Scan self-check:</span>
          <span>
            Taxable <span className="mono">{money(tc.scanned_taxable)}</span> + Tax{" "}
            <span className="mono">{money(tc.scanned_tax)}</span> = Grand{" "}
            <span className="mono">{money(tc.scanned_grand)}</span>
          </span>
          {tc.reconciled ? (
            <Badge tone="ok">Internally consistent ✓</Badge>
          ) : (
            <Badge tone="bad">Scan inconsistent — verify</Badge>
          )}
        </div>
      )}

      {/* Scanned total vs live form total */}
      <div
        className={`flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border px-3 py-2 text-[13px] ${
          applied && live != null
            ? matched
              ? "border-[var(--teal)] bg-[var(--teal-soft)]/50"
              : "border-destructive/50 bg-destructive/5"
            : "border-border bg-muted/30"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Scale className="h-4 w-4" /> Scanned total: <span className="mono">{money(scanned)}</span>
        </span>
        {applied && live != null && (
          <>
            <span>
              Form total: <strong className="mono">{money(live)}</strong>
            </span>
            {matched ? (
              <Badge tone="ok">Totals match ✓</Badge>
            ) : (
              <Badge tone="bad">
                Mismatch {diff! > 0 ? "+" : ""}{money(diff!)} — check lines/GST
              </Badge>
            )}
            {liveTx != null && (
              <span className="text-xs text-muted-foreground">
                Taxable {money(liveTx)} vs scanned {money(scannedTaxable)}{" "}
                {txMatched ? "✓" : `(Δ ${money(txDiff!)})`}
              </span>
            )}
          </>
        )}
        {(!applied || live == null) && (
          <span className="text-xs text-muted-foreground">Apply to compare with the form total live.</span>
        )}
      </div>

      <div>
        <Button type="button" size="sm" onClick={onApply}>
          <CheckCircle2 className="h-4 w-4 mr-1.5" /> {applied ? "Re-apply to form" : "Apply to form"}
        </Button>
      </div>
    </div>
  );
}
