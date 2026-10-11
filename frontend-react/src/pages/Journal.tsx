import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Trash2, CheckCircle } from "lucide-react";
import { AiModeButton, AiFillPanel, type AiDraft } from "../components/AiFill";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { useToast } from "../components/toast";
import { money, fmtDate } from "../lib/format";
import { useHotkeys } from "../lib/hotkeys";
import { QuickCreateLedger } from "../components/QuickCreate";
import {
  loadActiveVoucherTypes,
  type ConfiguredVoucherType,
} from "../lib/vouchers";
import {
  Button,
  DatePicker,
  Field,
  Input,
  Select,
  PageHeader,
  Panel,
  SearchBox,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  Money,
  Badge,
  Drawer,
  ConfirmDialog,
  Spinner,
} from "../components/ui";

interface Line {
  line_no: number;
  ledger_id: string;
  cost_center_id: string;
  debit_amount: number;
  credit_amount: number;
  remarks: string;
}
interface Voucher {
  id: string;
  voucherNo: string;
  voucherTypeId: string | null;
  voucherTypeName: string | null;
  voucherDate: string;
  referenceNo: string | null;
  narration: string | null;
  voucherStatus: string;
  totalDebit: number | null;
  totalCredit: number | null;
  details: any[];
}
interface Ledger {
  id: string;
  name: string;
  default_narration?: string | null;
}
interface CostCenter {
  id: string;
  name: string;
}

function emptyForm() {
  return {
    id: null as string | null,
    status: "DRAFT",
    voucher_type_id: "",
    voucher_type_name: "",
    voucher_date: new Date().toISOString().slice(0, 10),
    reference_no: "",
    narration: "",
    lines: [
      { line_no: 1, ledger_id: "", cost_center_id: "", debit_amount: 0, credit_amount: 0, remarks: "" },
      { line_no: 2, ledger_id: "", cost_center_id: "", debit_amount: 0, credit_amount: 0, remarks: "" },
    ] as Line[],
  };
}
type FormT = ReturnType<typeof emptyForm>;

export function Journal() {
  const { can } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const loc = useLocation();
  const canWrite = can("VOUCHER", "write");
  const canCancel = can("VOUCHER", "delete");
  const canQuickLedger = can("LEDGER", "write");

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<ConfiguredVoucherType[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<FormT>(emptyForm());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toCancel, setToCancel] = useState<Voucher | null>(null);
  const [quickLedgerFor, setQuickLedgerFor] = useState<number | null>(null);
  const [aiMode, setAiMode] = useState(false);

  async function load() {
    setLoading(true);
    const [vr, lr, cc, configuredTypes] = await Promise.all([
      api.get("/vouchers?voucher_type=JOURNAL"),
      api.get("/ledgers"),
      api.get("/cost-centers"),
      loadActiveVoucherTypes("JOURNAL"),
    ]);
    setVouchers(envelopeResult<Voucher[]>(vr) || []);
    setLedgers(envelopeResult<Ledger[]>(lr) || []);
    setCostCenters(envelopeResult<CostCenter[]>(cc) || []);
    setVoucherTypes(configuredTypes);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);
  useEffect(() => {
    const st = loc.state as any;
    if (st?.openNew && canWrite) openNew(st.ledgerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHotkeys(
    useMemo(
      () => ({
        "ctrl+n": () => canWrite && openNew(),
        "ctrl+s": () => drawer && saveDraft(),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [drawer, form, canWrite]
    )
  );

  const filtered = vouchers.filter((v) =>
    `${v.voucherNo} ${v.referenceNo || ""} ${v.narration || ""}`.toLowerCase().includes(q.toLowerCase())
  );

  const totals = useMemo(() => {
    const dr = form.lines.reduce((s, l) => s + (Number(l.debit_amount) || 0), 0);
    const cr = form.lines.reduce((s, l) => s + (Number(l.credit_amount) || 0), 0);
    return { dr, cr, diff: dr - cr };
  }, [form.lines]);

  const readOnly = !!form.id && form.status !== "DRAFT";
  const selectedVoucher = vouchers.find((v) => v.id === form.id);

  function openNew(preselectLedgerId?: string) {
    const f = emptyForm();
    const defaultType = voucherTypes[0];
    if (defaultType) {
      f.voucher_type_id = defaultType.id;
      f.voucher_type_name = defaultType.name;
    }
    if (preselectLedgerId) f.lines[0].ledger_id = preselectLedgerId;
    setForm(f);
    setSubmitted(false);
    setDrawer(true);
  }
  function openRow(v: Voucher) {
    setForm({
      id: v.id,
      status: v.voucherStatus,
      voucher_type_id: v.voucherTypeId || "",
      voucher_type_name: v.voucherTypeName || "",
      voucher_date: v.voucherDate,
      reference_no: v.referenceNo || "",
      narration: v.narration || "",
      lines: (v.details || []).map((d, i) => ({
        line_no: d.lineNo ?? i + 1,
        ledger_id: d.ledgerId || "",
        cost_center_id: d.costCenterId || "",
        debit_amount: d.debitAmount || 0,
        credit_amount: d.creditAmount || 0,
        remarks: d.remarks || "",
      })),
    });
    setSubmitted(false);
    setDrawer(true);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }
  function addLine() {
    setForm((f) => ({
      ...f,
      lines: [...f.lines, { line_no: f.lines.length + 1, ledger_id: "", cost_center_id: "", debit_amount: 0, credit_amount: 0, remarks: "" }],
    }));
  }
  function removeLine(i: number) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, line_no: idx + 1 })) }));
  }

  function fillFormFromAi(draft: AiDraft) {
    const f = draft.fields;
    const grand = Math.round((Number(f.grand_total) || 0) * 100) / 100;
    const ref = (f.invoice_no || "").slice(0, 50);
    setForm((prev) => {
      const keep = (i: number): Line =>
        prev.lines[i] || { line_no: i + 1, ledger_id: "", cost_center_id: "", debit_amount: 0, credit_amount: 0, remarks: "" };
      return {
        ...prev,
        voucher_date: f.invoice_date || prev.voucher_date,
        reference_no: ref,
        narration: (f.narration || "").slice(0, 50),
        lines: [
          { ...keep(0), line_no: 1, debit_amount: grand, credit_amount: 0, remarks: ref.slice(0, 30) },
          { ...keep(1), line_no: 2, debit_amount: 0, credit_amount: grand, remarks: ref.slice(0, 30) },
        ],
      };
    });
  }

  function validate(): boolean {
    setSubmitted(true);
    if (!form.voucher_type_id) {
      toast({ title: "Select a Voucher Type", tone: "error" });
      return false;
    }
    if (!form.voucher_date) return false;
    if (form.lines.some((l) => !l.ledger_id)) {
      toast({ title: "Every line needs a ledger", tone: "error" });
      return false;
    }
    if (totals.dr <= 0 || totals.cr <= 0 || Math.abs(totals.diff) > 0.01) {
      toast({ title: "Debits and credits must balance", tone: "error" });
      return false;
    }
    return true;
  }

  async function persist(): Promise<string | null> {
    if (!validate()) return null;
    setSaving(true);
    const payload = {
      voucher_date: form.voucher_date,
      reference_no: form.reference_no || null,
      narration: form.narration || null,
      details: form.lines.map((l) => ({
        line_no: l.line_no,
        ledger_id: l.ledger_id,
        cost_center_id: l.cost_center_id || null,
        debit_amount: Number(l.debit_amount) || 0,
        credit_amount: Number(l.credit_amount) || 0,
        remarks: l.remarks || null,
      })),
    };
    const r = form.id
      ? await api.put(`/vouchers/${form.id}`, payload)
      : await api.post(
          `/vouchers?voucher_type=JOURNAL&voucher_type_id=${encodeURIComponent(form.voucher_type_id)}`,
          payload
        );
    setSaving(false);
    if (!envelopeOk(r)) {
      toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
      return null;
    }
    return form.id || (r.data?.result?.id ?? null);
  }

  async function revealVoucher(id: string) {
    await load();
    const r = await api.get(`/vouchers/${id}`);
    const v = envelopeResult<Voucher>(r);
    if (v) openRow(v);
  }

  async function saveDraft() {
    const id = await persist();
    if (!id) return;
    toast({ title: "Draft saved", tone: "success" });
    await revealVoucher(id);
  }
  async function saveAndPost() {
    const id = await persist();
    if (!id) return;
    const r = await api.patch(`/vouchers/${id}/post`, {});
    if (!envelopeOk(r)) {
      toast({ title: "Could not post", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: "Voucher posted", tone: "success" });
    await revealVoucher(id);
  }
  async function cancelVoucher() {
    if (!toCancel) return;
    const r = await api.patch(`/vouchers/${toCancel.id}/cancel`, {});
    if (!envelopeOk(r)) {
      toast({ title: "Could not cancel", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: "Voucher cancelled", tone: "success" });
    setDrawer(false);
    load();
  }

  return (
    <PageHeader
      title="Journal Vouchers"
      sub="Double-entry adjustments — with inline quick-create for missing ledgers"
      actions={
        canWrite && (
          <Button size="sm" onClick={() => openNew()} title="Ctrl+N">
            <Plus className="h-4 w-4 mr-1.5" />
            New entry
          </Button>
        )
      }
    >
      <Panel pad={false} title={`${filtered.length} vouchers`} right={<SearchBox value={q} onChange={setQ} placeholder="Search no, ref, narration" />}>
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Voucher</Th>
                <Th>Voucher Type</Th>
                <Th>Date</Th>
                <Th>Reference</Th>
                <Th>Narration</Th>
                <Th right>Debit</Th>
                <Th right>Credit</Th>
                <Th className="w-28">Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={8} text="No journal vouchers yet." />}
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openRow(v)}>
                  <Td className="mono">{v.voucherNo}</Td>
                  <Td>{v.voucherTypeName || "Journal"}</Td>
                  <Td>{fmtDate(v.voucherDate)}</Td>
                  <Td className="mono text-muted-foreground">{v.referenceNo || "—"}</Td>
                  <Td className="max-w-[280px] truncate">{v.narration || "—"}</Td>
                  <Td right><Money v={v.totalDebit || 0} /></Td>
                  <Td right><Money v={v.totalCredit || 0} /></Td>
                  <Td>
                    <Badge tone={v.voucherStatus === "POSTED" ? "ok" : v.voucherStatus === "DRAFT" ? "warn" : "bad"}>
                      {v.voucherStatus}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        wide
        title={form.id ? `${form.status.toLowerCase()} voucher` : "New journal entry"}
        desc={readOnly ? "Posted vouchers are read-only. Cancel to reverse." : "Debits must equal credits. Ctrl+S saves a draft."}
        footer={
          <>
            {form.id && (form.status === "DRAFT" || form.status === "POSTED") && canCancel && (
              <Button
                variant="outline"
                className="mr-auto text-destructive border-destructive/40 hover:text-destructive"
                onClick={() => setToCancel(vouchers.find((v) => v.id === form.id) || null)}
              >
                Cancel voucher
              </Button>
            )}
            <Button variant="outline" onClick={() => setDrawer(false)}>
              Close
            </Button>
            {!readOnly && canWrite && (
              <>
                <Button variant="secondary" onClick={saveDraft} disabled={saving}>
                  Save draft
                </Button>
                <Button onClick={saveAndPost} disabled={saving}>
                  <CheckCircle className="h-4 w-4 mr-1.5" />
                  Save &amp; post
                </Button>
              </>
            )}
          </>
        }
      >
        {!readOnly && canWrite && (
          <div className="flex items-center justify-end mb-3">
            <AiModeButton active={aiMode} onToggle={() => setAiMode((v) => !v)} />
          </div>
        )}
        {aiMode && !readOnly && (
          <div className="mb-4">
            <AiFillPanel target="JOURNAL" onApply={fillFormFromAi} liveGrandTotal={totals.dr} />
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Field label="Voucher No">
            <div className="relative">
              <Input
                className="mono bg-muted text-muted-foreground font-medium"
                readOnly
                disabled
                value={form.id ? (selectedVoucher?.voucherNo || "") : "Auto-generated"}
              />
              {!form.id && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Badge tone="muted">AUTO</Badge>
                </span>
              )}
            </div>
          </Field>
          <Field label="Voucher Type" required error={submitted && !form.voucher_type_id ? "Required" : undefined}>
            <Select
              disabled={!!form.id}
              value={form.voucher_type_id}
              onChange={(e) => {
                const selected = voucherTypes.find((type) => type.id === e.target.value);
                setForm({ ...form, voucher_type_id: e.target.value, voucher_type_name: selected?.name || "" });
              }}
            >
              <option value="">Select Voucher Type</option>
              {form.voucher_type_id && !voucherTypes.some((type) => type.id === form.voucher_type_id) && (
                <option value={form.voucher_type_id}>{form.voucher_type_name || "Historical Voucher Type"}</option>
              )}
              {voucherTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Date" required error={submitted && !form.voucher_date ? "Required" : undefined}>
            <DatePicker disabled={readOnly} value={form.voucher_date} onChange={(val) => setForm({ ...form, voucher_date: val })} />
          </Field>
          <Field label="Reference no">
            <Input className="mono" placeholder="Optional (e.g. Bill #, Ref #)" disabled={readOnly} value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} />
          </Field>
          <Field label="Narration" className="col-span-2 md:col-span-4">
            <Input disabled={readOnly} value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} />
          </Field>
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th className="w-10">#</Th>
                <Th>Ledger</Th>
                <Th className="w-36">Cost center</Th>
                <Th right className="w-32">Debit</Th>
                <Th right className="w-32">Credit</Th>
                <Th className="w-36">Remarks</Th>
                <Th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {form.lines.map((l, i) => (
                <tr key={i} className="align-top">
                  <Td className="mono text-muted-foreground">{l.line_no}</Td>
                  <Td>
                    <Select
                      className={"h-8 " + (submitted && !l.ledger_id ? "border-destructive" : "")}
                      disabled={readOnly}
                      value={l.ledger_id}
                      onChange={(e) => {
                        if (e.target.value === "__create__") {
                          setQuickLedgerFor(i);
                          return;
                        }
                        const led = ledgers.find((x) => x.id === e.target.value);
                        updateLine(i, {
                          ledger_id: e.target.value,
                          remarks: l.remarks || led?.default_narration || "",
                        });
                      }}
                    >
                      <option value="">Select ledger</option>
                      {canQuickLedger && !readOnly && (
                        <option value="__create__">＋ Create new ledger…</option>
                      )}
                      {ledgers.map((lg) => (
                        <option key={lg.id} value={lg.id}>
                          {lg.name}
                        </option>
                      ))}
                    </Select>
                  </Td>
                  <Td>
                    <Select className="h-8" disabled={readOnly} value={l.cost_center_id} onChange={(e) => updateLine(i, { cost_center_id: e.target.value })}>
                      <option value="">—</option>
                      {costCenters.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                  </Td>
                  <Td right>
                    <Input
                      type="number"
                      className="h-8 text-right fig"
                      disabled={readOnly}
                      value={l.debit_amount || ""}
                      onChange={(e) => updateLine(i, { debit_amount: +e.target.value || 0, credit_amount: +e.target.value ? 0 : l.credit_amount })}
                    />
                  </Td>
                  <Td right>
                    <Input
                      type="number"
                      className="h-8 text-right fig"
                      disabled={readOnly}
                      value={l.credit_amount || ""}
                      onChange={(e) => updateLine(i, { credit_amount: +e.target.value || 0, debit_amount: +e.target.value ? 0 : l.debit_amount })}
                    />
                  </Td>
                  <Td>
                    <Input className="h-8" disabled={readOnly} value={l.remarks} onChange={(e) => updateLine(i, { remarks: e.target.value })} />
                  </Td>
                  <Td>
                    {!readOnly && form.lines.length > 1 && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeLine(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="ledger-rule-strong bg-muted/40">
                <td colSpan={3} className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Totals
                </td>
                <td className="px-4 py-2.5 text-right fig font-medium">{money(totals.dr)}</td>
                <td className="px-4 py-2.5 text-right fig font-medium">{money(totals.cr)}</td>
                <td colSpan={2} className="px-4 py-2.5">
                  {Math.abs(totals.diff) > 0.009 ? (
                    <span className="text-[12px] font-semibold text-[var(--red)]">Off by {money(Math.abs(totals.diff))}</span>
                  ) : (
                    <span className="text-[12px] font-semibold text-[var(--teal)]">Balanced ✓</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {!readOnly && (
          <Button variant="outline" size="sm" className="mt-3" onClick={addLine}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add line
          </Button>
        )}
      </Drawer>

      <QuickCreateLedger
        open={quickLedgerFor !== null}
        onClose={() => setQuickLedgerFor(null)}
        onCreated={(led) => {
          setLedgers((ls) => [...ls, led].sort((a, b) => a.name.localeCompare(b.name)));
          if (quickLedgerFor !== null) updateLine(quickLedgerFor, { ledger_id: led.id });
        }}
      />

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title={`Cancel ${toCancel?.voucherNo}?`}
        desc="The voucher stays on record as cancelled; its postings are reversed."
        confirmLabel="Cancel voucher"
        onConfirm={cancelVoucher}
      />
    </PageHeader>
  );
}
