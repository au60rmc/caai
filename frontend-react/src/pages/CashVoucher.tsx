import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus, Trash2, CheckCircle, Wallet, ArrowDownCircle } from "lucide-react";
import { AiModeButton, AiFillPanel, type AiDraft } from "../components/AiFill";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { useToast } from "../components/toast";
import { money, fmtDate } from "../lib/format";
import { useHotkeys } from "../lib/hotkeys";
import { QuickCreateLedger } from "../components/QuickCreate";
import {
  loadVoucherRefs,
  loadActiveVoucherTypes,
  finalizeLines,
  round2,
  type ConfiguredVoucherType,
  type LedgerLite,
  type CostCenterLite,
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
interface PayLine {
  ledger_id: string;
  amount: number;
  tds: number;
  cost_center_id: string;
  remarks: string;
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
    pay_mode: "Bank" as "Bank" | "Cash",
    account_ledger_id: "",
    cheque_no: "",
    cheque_date: "",
    lines: [{ ledger_id: "", amount: 0, tds: 0, cost_center_id: "", remarks: "" }] as PayLine[],
    source_document_type: null as string | null,
    source_document_id: null as string | null,
    payment_amount: 0,
  };
}
type FormT = ReturnType<typeof emptyForm>;

export function CashVoucher({ mode }: { mode: "PAYMENT" | "RECEIPT" }) {
  const isPayment = mode === "PAYMENT";
  const Title = isPayment ? "Payment Voucher" : "Receipt Voucher";
  const partyWord = isPayment ? "Payee" : "Received from";
  const { can } = useAuth();
  const { companyId, company } = useCompany();
  const [purchaseBills, setPurchaseBills] = useState<any[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const { toast } = useToast();
  const loc = useLocation();
  const canWrite = can("VOUCHER", "write");
  const canCancel = can("VOUCHER", "delete");
  const canQuickLedger = can("LEDGER", "write");

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<ConfiguredVoucherType[]>([]);
  const [ledgers, setLedgers] = useState<LedgerLite[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenterLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<FormT>(emptyForm());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toCancel, setToCancel] = useState<Voucher | null>(null);
  const [quickFor, setQuickFor] = useState<number | null>(null);
  const [aiMode, setAiMode] = useState(false);

  const bankLedgers = useMemo(
    () => ledgers.filter((l) => l.is_bank === "Y" || (l.category || "").toLowerCase() === "bank"),
    [ledgers]
  );
  const cashLedgers = useMemo(
    () => ledgers.filter((l) => l.is_cash === "Y" || (l.category || "").toLowerCase() === "cash"),
    [ledgers]
  );

  async function load() {
    setLoading(true);
    const isInvMode = company?.maintain_mode === "ACCOUNT_WITH_INVENTORY";
    const [vr, refs, configuredTypes, pbRes, siRes] = await Promise.all([
      api.get(`/vouchers?voucher_type=${mode}`),
      loadVoucherRefs(),
      loadActiveVoucherTypes(mode),
      isInvMode && isPayment ? api.get("/vouchers/purchase-bills") : Promise.resolve(null),
      isInvMode && !isPayment ? api.get("/vouchers/sales-invoices") : Promise.resolve(null),
    ]);
    setVouchers(envelopeResult<Voucher[]>(vr) || []);
    setLedgers(refs.ledgers);
    setCostCenters(refs.costCenters);
    setVoucherTypes(configuredTypes);
    if (pbRes) {
      setPurchaseBills(envelopeResult<any[]>(pbRes) || []);
    }
    if (siRes) {
      setSalesInvoices(envelopeResult<any[]>(siRes) || []);
    }
    setLoading(false);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, companyId, company?.maintain_mode]);

  useEffect(() => {
    const state = loc.state as any;
    if (state?.payPurchaseBillId && canWrite && isPayment && purchaseBills.length > 0) {
      const billId = state.payPurchaseBillId;
      const bill = purchaseBills.find((b) => b.id === billId);
      if (bill && (!form.id || form.source_document_id !== billId)) {
        const f = emptyForm();
        const defaultType = voucherTypes[0];
        if (defaultType) {
          f.voucher_type_id = defaultType.id;
          f.voucher_type_name = defaultType.name;
        }
        const firstBank = ledgers.find((l) => l.is_bank === "Y" || (l.category || "").toLowerCase() === "bank");
        if (firstBank) f.account_ledger_id = firstBank.id;
        
        f.source_document_type = "PURCHASE";
        f.source_document_id = billId;
        f.payment_amount = bill.balance_due;
        setForm(f);
        setSubmitted(false);
        setDrawer(true);
        
        window.history.replaceState({}, document.title);
      }
    } else if (state?.paySalesInvoiceId && canWrite && !isPayment && salesInvoices.length > 0) {
      const invId = state.paySalesInvoiceId;
      const inv = salesInvoices.find((s) => s.id === invId);
      if (inv && (!form.id || form.source_document_id !== invId)) {
        const f = emptyForm();
        const defaultType = voucherTypes[0];
        if (defaultType) {
          f.voucher_type_id = defaultType.id;
          f.voucher_type_name = defaultType.name;
        }
        const firstBank = ledgers.find((l) => l.is_bank === "Y" || (l.category || "").toLowerCase() === "bank");
        if (firstBank) f.account_ledger_id = firstBank.id;
        
        f.source_document_type = "SALES";
        f.source_document_id = invId;
        f.payment_amount = inv.balance_due;
        setForm(f);
        setSubmitted(false);
        setDrawer(true);
        
        window.history.replaceState({}, document.title);
      }
    } else if (state?.openNew && canWrite) {
      openNew();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseBills, salesInvoices, loc.state, voucherTypes, ledgers, canWrite, isPayment]);

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

  const totals = useMemo(() => {
    const isInvDocLinked = company?.maintain_mode === "ACCOUNT_WITH_INVENTORY" && form.source_document_id;
    if (isInvDocLinked) {
      const amt = Number(form.payment_amount) || 0;
      return { gross: round2(amt), tds: 0, net: round2(amt) };
    }
    const gross = form.lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    const tds = form.lines.reduce((s, l) => s + (Number(l.tds) || 0), 0);
    return { gross: round2(gross), tds: round2(tds), net: round2(gross - tds) };
  }, [form.lines, form.payment_amount, company?.maintain_mode, form.source_document_id]);

  const readOnly = !!form.id && form.status !== "DRAFT";

  function openNew() {
    const f = emptyForm();
    const defaultType = voucherTypes[0];
    if (defaultType) {
      f.voucher_type_id = defaultType.id;
      f.voucher_type_name = defaultType.name;
    }
    // Default the account ledger to the first cash/bank ledger available.
    const firstBank = ledgers.find((l) => l.is_bank === "Y" || (l.category || "").toLowerCase() === "bank");
    if (firstBank) f.account_ledger_id = firstBank.id;
    setForm(f);
    setSubmitted(false);
    setDrawer(true);
  }
  function openRow(v: Voucher) {
    // Reconstruct the friendly line view from the balanced details.
    const details = v.details || [];
    const accountLine = isPayment
      ? details.find((d) => (d.creditAmount || 0) > 0 && !isTdsLedger(d.ledgerId))
      : details.find((d) => (d.debitAmount || 0) > 0);
    const acctLedger = ledgers.find((l) => l.id === accountLine?.ledgerId);
    const partyLines = details.filter((d) =>
      isPayment ? (d.debitAmount || 0) > 0 : (d.creditAmount || 0) > 0 && d.ledgerId !== accountLine?.ledgerId
    );
    setForm({
      id: v.id,
      status: v.voucherStatus,
      voucher_type_id: v.voucherTypeId || "",
      voucher_type_name: v.voucherTypeName || "",
      voucher_date: v.voucherDate,
      reference_no: v.referenceNo || "",
      narration: v.narration || "",
      pay_mode:
        acctLedger && (acctLedger.is_cash === "Y" || (acctLedger.category || "").toLowerCase() === "cash")
          ? "Cash"
          : "Bank",
      account_ledger_id: accountLine?.ledgerId || "",
      cheque_no: "",
      cheque_date: "",
      lines:
        partyLines.length > 0
          ? partyLines.map((d) => ({
              ledger_id: d.ledgerId,
              amount: isPayment ? d.debitAmount || 0 : d.creditAmount || 0,
              tds: 0,
              cost_center_id: d.costCenterId || "",
              remarks: d.remarks || "",
            }))
          : emptyForm().lines,
      source_document_type: (v as any).source_document_type || null,
      source_document_id: (v as any).source_document_id || null,
      payment_amount: v.totalDebit || 0,
    });
    setSubmitted(false);
    setDrawer(true);
  }

  function isTdsLedger(ledgerId: string) {
    const l = ledgers.find((x) => x.id === ledgerId);
    return (l?.name || "").toLowerCase().includes("tds");
  }

  function updateLine(i: number, patch: Partial<PayLine>) {
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  }
  function addLine() {
    setForm((f) => ({ ...f, lines: [...f.lines, { ledger_id: "", amount: 0, tds: 0, cost_center_id: "", remarks: "" }] }));
  }
  function removeLine(i: number) {
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));
  }

  function fillFormFromAi(draft: AiDraft) {
    const f = draft.fields;
    const grand = Math.round((Number(f.grand_total) || 0) * 100) / 100;
    const ref = (f.invoice_no || "").slice(0, 50);
    const best = (draft.candidates || [])[0];
    let ledgerId =
      best && best.score >= 80 && best.ledger_id && ledgers.some((l) => l.id === best.ledger_id)
        ? best.ledger_id
        : "";
    if (!ledgerId) {
      const hint = (isPayment ? f.seller_name_hint : f.buyer_name_hint || "").toLowerCase();
      if (hint.length >= 3) {
        const m =
          ledgers.find((l) => (l.name || "").toLowerCase() === hint) ||
          ledgers.find((l) => (l.name || "").toLowerCase().includes(hint.slice(0, 12)));
        if (m) ledgerId = m.id;
      }
      if (!ledgerId) {
        toast({ title: `${partyWord} ledger not matched — select manually`, tone: "info" });
      }
    }
    setForm((prev) => ({
      ...prev,
      reference_no: ref,
      voucher_date: f.invoice_date || prev.voucher_date,
      narration: (f.narration || "").slice(0, 50),
      lines: [
        {
          ledger_id: ledgerId || prev.lines[0]?.ledger_id || "",
          amount: grand,
          tds: 0,
          cost_center_id: prev.lines[0]?.cost_center_id || "",
          remarks: ref,
        },
      ],
    }));
  }

  function buildDetails() {
    const acct = form.account_ledger_id;
    const isInvMode = company?.maintain_mode === "ACCOUNT_WITH_INVENTORY" && form.source_document_id;
    
    if (isInvMode) {
      if (isPayment) {
        const bill = purchaseBills.find((b) => b.id === form.source_document_id);
        const supplierLedgerId = bill ? bill.supplier_ledger_id : (form.lines[0]?.ledger_id || "");
        const rows = [
          {
            ledger_id: supplierLedgerId,
            debit_amount: round2(Number(form.payment_amount) || 0),
            credit_amount: 0,
            remarks: form.reference_no || null
          },
          {
            ledger_id: acct,
            debit_amount: 0,
            credit_amount: round2(Number(form.payment_amount) || 0),
            remarks: form.narration || null
          }
        ];
        return finalizeLines(rows);
      } else {
        const inv = salesInvoices.find((s) => s.id === form.source_document_id);
        const customerLedgerId = inv ? inv.customer_ledger_id : (form.lines[0]?.ledger_id || "");
        const rows = [
          {
            ledger_id: acct,
            debit_amount: round2(Number(form.payment_amount) || 0),
            credit_amount: 0,
            remarks: form.narration || null
          },
          {
            ledger_id: customerLedgerId,
            debit_amount: 0,
            credit_amount: round2(Number(form.payment_amount) || 0),
            remarks: form.reference_no || null
          }
        ];
        return finalizeLines(rows);
      }
    }
    
    const tdsLedger = ledgers.find((l) => (l.name || "").toLowerCase() === "tds payable");
    const rows: Array<{ ledger_id: string; debit_amount: number; credit_amount: number; cost_center_id?: string | null; remarks?: string | null }> = [];
    if (isPayment) {
      // Dr payees (gross), Cr TDS payable (sum), Cr bank/cash (net).
      form.lines.forEach((l) =>
        rows.push({ ledger_id: l.ledger_id, debit_amount: round2(Number(l.amount) || 0), credit_amount: 0, cost_center_id: l.cost_center_id || null, remarks: l.remarks || null })
      );
      if (totals.tds > 0 && tdsLedger)
        rows.push({ ledger_id: tdsLedger.id, debit_amount: 0, credit_amount: totals.tds, remarks: "TDS deducted" });
      rows.push({ ledger_id: acct, debit_amount: 0, credit_amount: totals.net, remarks: form.narration || null });
    } else {
      // Dr bank/cash (gross), Cr each party line.
      rows.push({ ledger_id: acct, debit_amount: totals.gross, credit_amount: 0, remarks: form.narration || null });
      form.lines.forEach((l) =>
        rows.push({ ledger_id: l.ledger_id, debit_amount: 0, credit_amount: round2(Number(l.amount) || 0), cost_center_id: l.cost_center_id || null, remarks: l.remarks || null })
      );
    }
    return finalizeLines(rows);
  }

  function validate(): boolean {
    setSubmitted(true);
    if (!form.voucher_type_id) {
      toast({ title: "Select a Voucher Type", tone: "error" });
      return false;
    }
    if (!form.voucher_date) return false;
    if (!form.account_ledger_id) {
      toast({ title: `Select the ${form.pay_mode.toLowerCase()} account`, tone: "error" });
      return false;
    }
    
    const isInvMode = company?.maintain_mode === "ACCOUNT_WITH_INVENTORY";
    if (isInvMode) {
      if (!form.source_document_id) {
        toast({ title: `Select a ${isPayment ? "Purchase Bill" : "Sales Invoice"} reference`, tone: "error" });
        return false;
      }
      if (!(Number(form.payment_amount) > 0)) {
        toast({ title: "Payment amount must be greater than zero", tone: "error" });
        return false;
      }
    } else {
      if (form.lines.some((l) => !l.ledger_id || !(Number(l.amount) > 0))) {
        toast({ title: `Each ${partyWord.toLowerCase()} line needs a ledger and amount`, tone: "error" });
        return false;
      }
      if (isPayment && form.lines.some((l) => Number(l.tds) > Number(l.amount))) {
        toast({ title: "TDS cannot exceed the line amount", tone: "error" });
        return false;
      }
    }
    if (form.pay_mode === "Bank" && form.cheque_no && !form.cheque_no.trim()) return false;
    return true;
  }

  async function persist(): Promise<string | null> {
    if (!validate()) return null;
    const details = buildDetails();
    setSaving(true);
    const refParts = [form.reference_no, form.cheque_no ? `Cheque ${form.cheque_no}` : ""].filter(Boolean);
    const payload = {
      voucher_date: form.voucher_date,
      reference_no: refParts.join(" · ").slice(0, 50) || null,
      narration: (form.narration || "").slice(0, 50) || null,
      details,
      source_document_type: form.source_document_type,
      source_document_id: form.source_document_id,
    };
    const r = form.id
      ? await api.put(`/vouchers/${form.id}`, payload)
      : await api.post(
          `/vouchers?voucher_type=${mode}&voucher_type_id=${encodeURIComponent(form.voucher_type_id)}`,
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
    toast({ title: `${Title} posted`, tone: "success" });
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

  const accountOptions = form.pay_mode === "Cash" ? cashLedgers : bankLedgers;

  return (
    <PageHeader
      title={Title}
      sub={isPayment ? "Money paid out via cash or bank — with optional TDS" : "Money received from customers into cash or bank"}
      actions={
        canWrite && (
          <Button size="sm" onClick={() => openNew()} title="Ctrl+N">
            <Plus className="h-4 w-4 mr-1.5" />
            New {isPayment ? "payment" : "receipt"}
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
                <Th right>Amount</Th>
                <Th className="w-28">Status</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={7} text={`No ${isPayment ? "payment" : "receipt"} vouchers yet.`} />}
              {filtered.map((v) => (
                <tr key={v.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openRow(v)}>
                  <Td className="mono">{v.voucherNo}</Td>
                  <Td>{v.voucherTypeName || (isPayment ? "Payment" : "Receipt")}</Td>
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
        wide
        title={form.id ? `${form.status.toLowerCase()} ${isPayment ? "payment" : "receipt"}` : `New ${isPayment ? "payment" : "receipt"}`}
        desc={readOnly ? "Posted vouchers are read-only. Cancel to reverse." : "Ctrl+S saves a draft. Post to affect the books."}
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
            <AiFillPanel target={mode} onApply={fillFormFromAi} liveGrandTotal={totals.gross} />
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
          <Field label="Date" required error={submitted && !form.voucher_date ? "Required" : undefined}>
            <DatePicker disabled={readOnly} value={form.voucher_date} onChange={(val) => setForm({ ...form, voucher_date: val })} />
          </Field>
          <Field label="Mode">
            <Select
              disabled={readOnly}
              value={form.pay_mode}
              onChange={(e) => {
                const pm = e.target.value as "Bank" | "Cash";
                const first = (pm === "Cash" ? cashLedgers : bankLedgers)[0];
                setForm({ ...form, pay_mode: pm, account_ledger_id: first?.id || "" });
              }}
            >
              <option value="Bank">Bank</option>
              <option value="Cash">Cash</option>
            </Select>
          </Field>
          <Field label={`${form.pay_mode} account`} required className="md:col-span-2" error={submitted && !form.account_ledger_id ? "Required" : undefined}>
            <Select disabled={readOnly} value={form.account_ledger_id} onChange={(e) => setForm({ ...form, account_ledger_id: e.target.value })}>
              <option value="">Select {form.pay_mode.toLowerCase()} ledger</option>
              {accountOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </Field>
          {company?.maintain_mode === "ACCOUNT_WITH_INVENTORY" ? (
            <Field label={isPayment ? "Reference / Purchase Bill" : "Reference / Sales Invoice"} required className="col-span-2" error={submitted && !form.source_document_id ? "Required" : undefined}>
              <Select
                disabled={!!form.id}
                value={form.source_document_id || ""}
                onChange={(e) => {
                  const docId = e.target.value;
                  if (isPayment) {
                    const bill = purchaseBills.find((b) => b.id === docId);
                    setForm({
                      ...form,
                      source_document_type: "PURCHASE",
                      source_document_id: docId,
                      payment_amount: bill ? bill.balance_due : 0,
                    });
                  } else {
                    const inv = salesInvoices.find((s) => s.id === docId);
                    setForm({
                      ...form,
                      source_document_type: "SALES",
                      source_document_id: docId,
                      payment_amount: inv ? inv.balance_due : 0,
                    });
                  }
                }}
              >
                <option value="">Select {isPayment ? "Purchase Bill" : "Sales Invoice"}</option>
                {isPayment ? (
                  <>
                    {form.source_document_id && !purchaseBills.some((b) => b.id === form.source_document_id) && (
                      <option value={form.source_document_id}>
                        Reference Bill
                      </option>
                    )}
                    {purchaseBills.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.voucher_no} ({b.reference_no || "No Ref"}) — Bal: {money(b.balance_due)}
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    {form.source_document_id && !salesInvoices.some((s) => s.id === form.source_document_id) && (
                      <option value={form.source_document_id}>
                        Reference Invoice
                      </option>
                    )}
                    {salesInvoices.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.voucher_no} ({s.reference_no || "No Ref"}) — Bal: {money(s.balance_due)}
                      </option>
                    ))}
                  </>
                )}
              </Select>
            </Field>
          ) : (
            <Field label="Reference / UTR no">
              <Input className="mono" placeholder="Optional (e.g. UTR #, Ref #)" disabled={readOnly} value={form.reference_no} onChange={(e) => setForm({ ...form, reference_no: e.target.value })} />
            </Field>
          )}
          {form.pay_mode === "Bank" && (
            <>
              <Field label="Cheque no">
                <Input className="mono" disabled={readOnly} value={form.cheque_no} onChange={(e) => setForm({ ...form, cheque_no: e.target.value })} />
              </Field>
              <Field label="Cheque date">
                <DatePicker disabled={readOnly} value={form.cheque_date} onChange={(val) => setForm({ ...form, cheque_date: val })} />
              </Field>
            </>
          )}
          <Field label="Narration" className={form.pay_mode === "Bank" ? "col-span-2 md:col-span-4" : "col-span-2"}>
            <Input disabled={readOnly} value={form.narration} onChange={(e) => setForm({ ...form, narration: e.target.value })} />
          </Field>
        </div>

        {(() => {
          const isInvMode = company?.maintain_mode === "ACCOUNT_WITH_INVENTORY";
          if (isInvMode) {
            if (isPayment) {
              const selectedBill = purchaseBills.find((b) => b.id === form.source_document_id);
              const supplierName = selectedBill ? selectedBill.supplier_name : (form.lines[0]?.ledger_id ? ledgers.find(l => l.id === form.lines[0].ledger_id)?.name : "—");
              const billTotal = selectedBill ? selectedBill.bill_total : null;
              const prevPaid = selectedBill ? selectedBill.previously_paid : 0;
              const prevPaidExcl = form.id && form.status === "POSTED" ? Math.max(0, prevPaid - (vouchers.find(v => v.id === form.id)?.totalDebit || 0)) : prevPaid;
              const balDue = selectedBill ? (selectedBill.bill_total - prevPaidExcl - (Number(form.payment_amount) || 0)) : 0;

              return (
                <div className="space-y-4 rounded-md border border-border p-4 bg-muted/20 text-[13px] mb-4">
                  <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-2">Purchase Bill Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Supplier / Payee">
                      <Input disabled value={supplierName || "—"} />
                    </Field>
                    <Field label="Bill Total">
                      <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md font-semibold mono">
                        {billTotal !== null ? money(billTotal) : "—"}
                      </div>
                    </Field>
                    <Field label="Previously Paid">
                      <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md font-semibold mono text-muted-foreground">
                        {billTotal !== null ? money(prevPaidExcl) : "—"}
                      </div>
                    </Field>
                    <Field label="Payment Amount" required error={submitted && !(Number(form.payment_amount) > 0) ? "Required" : undefined}>
                      <Input
                        type="number"
                        disabled={readOnly}
                        value={form.payment_amount || ""}
                        onChange={(e) => setForm({ ...form, payment_amount: +e.target.value || 0 })}
                      />
                    </Field>
                    <Field label="Balance Due">
                      <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md font-semibold mono text-destructive">
                        {billTotal !== null ? money(balDue) : "—"}
                      </div>
                    </Field>
                  </div>
                </div>
              );
            } else {
              const selectedInv = salesInvoices.find((s) => s.id === form.source_document_id);
              const customerName = selectedInv ? selectedInv.customer_name : (form.lines[0]?.ledger_id ? ledgers.find(l => l.id === form.lines[0].ledger_id)?.name : "—");
              const invTotal = selectedInv ? selectedInv.invoice_total : null;
              const prevRec = selectedInv ? selectedInv.previously_received : 0;
              const prevRecExcl = form.id && form.status === "POSTED" ? Math.max(0, prevRec - (vouchers.find(v => v.id === form.id)?.totalDebit || 0)) : prevRec;
              const balDue = selectedInv ? (selectedInv.invoice_total - prevRecExcl - (Number(form.payment_amount) || 0)) : 0;

              return (
                <div className="space-y-4 rounded-md border border-border p-4 bg-muted/20 text-[13px] mb-4">
                  <h4 className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px] mb-2">Sales Invoice Details</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <Field label="Customer / Received From">
                      <Input disabled value={customerName || "—"} />
                    </Field>
                    <Field label="Invoice Total">
                      <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md font-semibold mono">
                        {invTotal !== null ? money(invTotal) : "—"}
                      </div>
                    </Field>
                    <Field label="Previously Received">
                      <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md font-semibold mono text-muted-foreground">
                        {invTotal !== null ? money(prevRecExcl) : "—"}
                      </div>
                    </Field>
                    <Field label="Payment Amount" required error={submitted && !(Number(form.payment_amount) > 0) ? "Required" : undefined}>
                      <Input
                        type="number"
                        disabled={readOnly}
                        value={form.payment_amount || ""}
                        onChange={(e) => setForm({ ...form, payment_amount: +e.target.value || 0 })}
                      />
                    </Field>
                    <Field label="Balance Due">
                      <div className="h-9 flex items-center px-3 bg-muted/40 rounded-md font-semibold mono text-destructive">
                        {invTotal !== null ? money(balDue) : "—"}
                      </div>
                    </Field>
                  </div>
                </div>
              );
            }
          }

          return (
            <>
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr>
                      <Th className="w-10">#</Th>
                      <Th>{partyWord} ledger</Th>
                      <Th className="w-36">Cost center</Th>
                      <Th right className="w-32">Amount</Th>
                      {isPayment && <Th right className="w-28">TDS</Th>}
                      <Th className="w-36">Remarks</Th>
                      <Th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.lines.map((l, i) => (
                      <tr key={i} className="align-top">
                        <Td className="mono text-muted-foreground">{i + 1}</Td>
                        <Td>
                          <Select
                            className={"h-8 " + (submitted && !l.ledger_id ? "border-destructive" : "")}
                            disabled={readOnly}
                            value={l.ledger_id}
                            onChange={(e) => {
                              if (e.target.value === "__create__") { setQuickFor(i); return; }
                              updateLine(i, { ledger_id: e.target.value });
                            }}
                          >
                            <option value="">Select ledger</option>
                            {canQuickLedger && !readOnly && <option value="__create__">＋ Create new ledger…</option>}
                            {ledgers.map((lg) => (
                              <option key={lg.id} value={lg.id}>{lg.name}</option>
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
                          <Input type="number" className="h-8 text-right fig" disabled={readOnly} value={l.amount || ""} onChange={(e) => updateLine(i, { amount: +e.target.value || 0 })} />
                        </Td>
                        {isPayment && (
                          <Td right>
                            <Input type="number" className="h-8 text-right fig" disabled={readOnly} value={l.tds || ""} onChange={(e) => updateLine(i, { tds: +e.target.value || 0 })} />
                          </Td>
                        )}
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
                        {isPayment ? "Gross / TDS / Net" : "Total received"}
                      </td>
                      <td className="px-4 py-2.5 text-right fig font-medium">{money(totals.gross)}</td>
                      {isPayment && <td className="px-4 py-2.5 text-right fig font-medium">{money(totals.tds)}</td>}
                      <td colSpan={2} className="px-4 py-2.5 text-[12px] font-semibold" style={{ color: "var(--teal)" }}>
                        Net {money(totals.net)}
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
            </>
          );
        })()}

        <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
          {isPayment ? <Wallet className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
          {company?.maintain_mode === "ACCOUNT_WITH_INVENTORY"
            ? isPayment
              ? "Posts: Dr Supplier ledger, Cr selected Cash/Bank ledger."
              : "Posts: Dr selected Cash/Bank ledger, Cr Customer ledger."
            : isPayment
              ? "Posts: Dr payees, Cr TDS Payable (if any), Cr the selected bank/cash account."
              : "Posts: Dr the selected bank/cash account, Cr each party ledger."}
        </div>
      </Drawer>

      <QuickCreateLedger
        open={quickFor !== null}
        onClose={() => setQuickFor(null)}
        onCreated={(led) => {
          setLedgers((ls) => [...ls, led].sort((a, b) => a.name.localeCompare(b.name)));
          if (quickFor !== null) updateLine(quickFor, { ledger_id: led.id });
        }}
      />

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
