import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, CheckCircle, ArrowLeftRight } from "lucide-react";
import { AiModeButton, AiFillPanel, type AiDraft } from "../components/AiFill";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { useToast } from "../components/toast";
import { money, fmtDate } from "../lib/format";
import { useHotkeys } from "../lib/hotkeys";
import {
  loadActiveVoucherTypes,
  loadVoucherRefs,
  round2,
  finalizeLines,
  type ConfiguredVoucherType,
  type LedgerLite,
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
  details: any[];
}

function emptyForm() {
  return {
    id: null as string | null,
    status: "DRAFT",
    voucher_type_id: "",
    voucher_type_name: "",
    voucher_date: new Date().toISOString().slice(0, 10),
    from_ledger_id: "",
    to_ledger_id: "",
    amount: 0,
    reference_no: "",
    narration: "",
  };
}
type FormT = ReturnType<typeof emptyForm>;

export function Contra() {
  const { can } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const loc = useLocation();
  const canWrite = can("VOUCHER", "write");
  const canCancel = can("VOUCHER", "delete");

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<ConfiguredVoucherType[]>([]);
  const [ledgers, setLedgers] = useState<LedgerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<FormT>(emptyForm());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toCancel, setToCancel] = useState<Voucher | null>(null);
  const [aiMode, setAiMode] = useState(false);

  // Contra only moves money between cash & bank accounts.
  const cashBank = useMemo(
    () =>
      ledgers.filter(
        (l) =>
          l.is_bank === "Y" ||
          l.is_cash === "Y" ||
          ["bank", "cash"].includes((l.category || "").toLowerCase())
      ),
    [ledgers]
  );

  async function load() {
    setLoading(true);
    const [vr, refs, configuredTypes] = await Promise.all([
      api.get(`/vouchers?voucher_type=CONTRA`),
      loadVoucherRefs(),
      loadActiveVoucherTypes("CONTRA"),
    ]);
    setVouchers(envelopeResult<Voucher[]>(vr) || []);
    setLedgers(refs.ledgers);
    setVoucherTypes(configuredTypes);
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);
  useEffect(() => {
    if ((loc.state as any)?.openNew && canWrite) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHotkeys(
    useMemo(
      () => ({ "ctrl+n": () => canWrite && openNew(), "ctrl+s": () => drawer && saveDraft() }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [drawer, form, canWrite]
    )
  );

  const filtered = vouchers.filter((v) =>
    `${v.voucherNo} ${v.referenceNo || ""} ${v.narration || ""}`.toLowerCase().includes(q.toLowerCase())
  );

  const readOnly = !!form.id && form.status !== "DRAFT";

  function openNew() {
    const next = emptyForm();
    const defaultType = voucherTypes[0];
    if (defaultType) {
      next.voucher_type_id = defaultType.id;
      next.voucher_type_name = defaultType.name;
    }
    setForm(next);
    setSubmitted(false);
    setDrawer(true);
  }
  function openRow(v: Voucher) {
    const details = v.details || [];
    const toLine = details.find((d) => (d.debitAmount || 0) > 0);
    const fromLine = details.find((d) => (d.creditAmount || 0) > 0);
    setForm({
      id: v.id,
      status: v.voucherStatus,
      voucher_type_id: v.voucherTypeId || "",
      voucher_type_name: v.voucherTypeName || "",
      voucher_date: v.voucherDate,
      from_ledger_id: fromLine?.ledgerId || "",
      to_ledger_id: toLine?.ledgerId || "",
      amount: toLine?.debitAmount || fromLine?.creditAmount || 0,
      reference_no: v.referenceNo || "",
      narration: v.narration || "",
    });
    setSubmitted(false);
    setDrawer(true);
  }

  function fillFormFromAi(draft: AiDraft) {
    const f = draft.fields;
    setForm((prev) => ({
      ...prev,
      voucher_date: f.invoice_date || prev.voucher_date,
      reference_no: (f.invoice_no || "").slice(0, 50),
      amount: Math.round((Number(f.grand_total) || 0) * 100) / 100,
      narration: (f.narration || "").slice(0, 50),
    }));
  }

  function validate(): boolean {
    setSubmitted(true);
    if (!form.voucher_type_id) {
      toast({ title: "Select a Voucher Type", tone: "error" });
      return false;
    }
    if (!form.voucher_date) return false;
    if (!form.from_ledger_id || !form.to_ledger_id) {
      toast({ title: "Choose both the source and destination account", tone: "error" });
      return false;
    }
    if (form.from_ledger_id === form.to_ledger_id) {
      toast({ title: "Source and destination must differ", tone: "error" });
      return false;
    }
    if (!(Number(form.amount) > 0)) {
      toast({ title: "Enter an amount greater than zero", tone: "error" });
      return false;
    }
    return true;
  }

  async function persist(): Promise<string | null> {
    if (!validate()) return null;
    setSaving(true);
    const amt = round2(Number(form.amount));
    const details = finalizeLines([
      { ledger_id: form.to_ledger_id, debit_amount: amt, credit_amount: 0, remarks: "To" },
      { ledger_id: form.from_ledger_id, debit_amount: 0, credit_amount: amt, remarks: "From" },
    ]);
    const payload = {
      voucher_date: form.voucher_date,
      reference_no: (form.reference_no || "").slice(0, 50) || null,
      narration: (form.narration || "").slice(0, 50) || null,
      details,
    };
    const r = form.id
      ? await api.put(`/vouchers/${form.id}`, payload)
      : await api.post(
          `/vouchers?voucher_type=CONTRA&voucher_type_id=${encodeURIComponent(form.voucher_type_id)}`,
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
      title="Contra Voucher"
      sub="Internal fund transfers between your own cash and bank accounts"
      actions={
        canWrite && (
          <Button size="sm" onClick={() => openNew()} title="Ctrl+N">
            <Plus className="h-4 w-4 mr-1.5" />
            New contra
          </Button>
        )
      }
    >
      <Panel pad={false} title={`${filtered.length} transfers`} right={<SearchBox value={q} onChange={setQ} placeholder="Search no, ref, narration" />}>
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
                <Th right>Amount</Th>
                <Th className="w-28">Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={7} text="No contra vouchers yet." />}
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openRow(v)}>
                  <Td className="mono">{v.voucherNo}</Td>
                  <Td>{v.voucherTypeName || "Contra"}</Td>
                  <Td>{fmtDate(v.voucherDate)}</Td>
                  <Td className="mono text-muted-foreground">{v.referenceNo || "—"}</Td>
                  <Td className="max-w-[280px] truncate">{v.narration || "—"}</Td>
                  <Td right><Money v={v.totalDebit || 0} /></Td>
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
        title={form.id ? `${form.status.toLowerCase()} contra` : "New contra transfer"}
        desc={readOnly ? "Posted vouchers are read-only. Cancel to reverse." : "Move money between cash and bank. Ctrl+S saves a draft."}
        footer={
          <>
            {form.id && form.status !== "CANCELLED" && canCancel && (
              <Button variant="outline" className="mr-auto text-destructive border-destructive/40 hover:text-destructive" onClick={() => setToCancel(vouchers.find((v) => v.id === form.id) || null)}>
                Cancel voucher
              </Button>
            )}
            <Button variant="outline" onClick={() => setDrawer(false)}>Close</Button>
            {!readOnly && canWrite && (
              <>
                <Button variant="secondary" onClick={saveDraft} disabled={saving}>Save draft</Button>
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
            <AiFillPanel target="CONTRA" onApply={fillFormFromAi} liveGrandTotal={Number(form.amount) || 0} />
          </div>
        )}
        <div className="space-y-4">
          <Field label="Voucher No">
            <div className="relative">
              <Input
                className="mono bg-muted text-muted-foreground font-medium"
                readOnly
                disabled
                value={form.id ? (vouchers.find((v) => v.id === form.id)?.voucherNo || "") : "Auto-generated"}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" required error={submitted && !form.voucher_date ? "Required" : undefined}>
              <DatePicker disabled={readOnly} value={form.voucher_date} onChange={(val) => setForm({ ...form, voucher_date: val })} />
            </Field>
            <Field label="Reference no">
              <Input className="mono" placeholder="Optional (e.g. UTR #, Cheque #)" disabled={readOnly} value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <Field label="From (source)" required error={submitted && !form.from_ledger_id ? "Required" : undefined}>
              <Select disabled={readOnly} value={form.from_ledger_id} onChange={(e) => setForm({ ...form, from_ledger_id: e.target.value })}>
                <option value="">Select account</option>
                {cashBank.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>
            <div className="pb-2 text-muted-foreground">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <Field label="To (destination)" required error={submitted && !form.to_ledger_id ? "Required" : undefined}>
              <Select disabled={readOnly} value={form.to_ledger_id} onChange={(e) => setForm({ ...form, to_ledger_id: e.target.value })}>
                <option value="">Select account</option>
                {cashBank.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Amount" required error={submitted && !(Number(form.amount) > 0) ? "Enter an amount" : undefined}>
            <Input type="number" className="fig" disabled={readOnly} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: +e.target.value || 0 })} />
          </Field>
          <Field label="Narration">
            <Input disabled={readOnly} value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} placeholder="e.g. Cash deposited into HDFC Bank" />
          </Field>
          {cashBank.length < 2 && (
            <p className="text-[12px] hint-warning">Add at least two cash/bank ledgers to record a transfer.</p>
          )}
        </div>
      </Drawer>

      <ConfirmDialog
        open={!!toCancel}
        onClose={() => setToCancel(null)}
        title={`Cancel ${toCancel?.voucherNo}?`}
        desc="The voucher stays on record as cancelled and no longer affects the books."
        confirmLabel="Cancel voucher"
        onConfirm={cancelVoucher}
      />
    </PageHeader>
  );
}
