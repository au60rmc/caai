import { useEffect, useMemo, useState } from "react";
import { CheckCircle, Plus, Trash2 } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { useToast } from "../components/toast";
import {
  Badge,
  Button,
  ConfirmDialog,
  Drawer,
  EmptyRow,
  Field,
  Input,
  DatePicker,
  Money,
  PageHeader,
  Panel,
  SearchBox,
  Select,
  Spinner,
  TableWrap,
  Td,
  Textarea,
  Th,
} from "../components/ui";
import { AiModeButton, AiFillPanel, type AiDraft } from "../components/AiFill";
import { api, envelopeMessage, envelopeOk, envelopeResult } from "../lib/api";
import { fmtDate, money } from "../lib/format";
import { useHotkeys } from "../lib/hotkeys";
import {
  loadAccountingLedgerOptions,
  loadActiveVoucherTypes,
  loadVoucherRefs,
  computeDueDate,
  round2,
  type AccountingLedgerOption,
  type AccountingLedgerOptions,
  type ConfiguredVoucherType,
  type PartyLite,
  type LedgerLite,
} from "../lib/vouchers";

type EntrySide = "DEBIT" | "CREDIT";

interface VoucherDetail {
  lineNo: number;
  ledgerId: string;
  ledgerName?: string | null;
  debitAmount: number | null;
  creditAmount: number | null;
  remarks: string | null;
}

interface Voucher {
  id: string;
  voucherNo: string;
  voucherTypeId: string | null;
  voucherTypeName: string | null;
  baseVoucherType: string;
  voucherDate: string;
  dueDate?: string | null;
  referenceNo: string | null;
  narration: string | null;
  voucherStatus: string;
  totalDebit: number | null;
  totalCredit: number | null;
  details: VoucherDetail[];
}

interface AccountingLine {
  line_no: number;
  side: EntrySide;
  ledger_id: string;
  ledger_name: string;
  amount: number;
  remarks: string;
}

function emptyLine(lineNo: number, side: EntrySide): AccountingLine {
  return {
    line_no: lineNo,
    side,
    ledger_id: "",
    ledger_name: "",
    amount: 0,
    remarks: "",
  };
}

function emptyForm() {
  return {
    id: null as string | null,
    status: "DRAFT",
    voucher_no: "",
    voucher_type_id: "",
    voucher_type_name: "",
    base_voucher_type: "",
    voucher_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    party_id: "",
    reference_no: "",
    reference_date: "",
    narration: "",
    lines: [emptyLine(1, "DEBIT"), emptyLine(2, "CREDIT")],
  };
}

type FormState = ReturnType<typeof emptyForm>;

export function AccountingVouchers() {
  const { can } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const canWrite = can("VOUCHER", "write");
  const canDelete = can("VOUCHER", "delete");

  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [voucherTypes, setVoucherTypes] = useState<ConfiguredVoucherType[]>([]);
  const [parties, setParties] = useState<PartyLite[]>([]);
  const [ledgers, setLedgers] = useState<LedgerLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerOptions, setLedgerOptions] = useState<AccountingLedgerOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Voucher | null>(null);
  const [aiMode, setAiMode] = useState(false);

  async function load() {
    setLoading(true);
    const [voucherResponse, activeTypes, refs] = await Promise.all([
      api.get("/vouchers"),
      loadActiveVoucherTypes(),
      loadVoucherRefs(),
    ]);
    setVouchers(envelopeResult<Voucher[]>(voucherResponse) || []);
    setVoucherTypes(activeTypes);
    setParties(refs.parties);
    setLedgers(refs.ledgers);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useEffect(() => {
    let ignore = false;
    if (!drawer || !form.voucher_type_id) {
      setLedgerOptions(null);
      return;
    }
    setOptionsLoading(true);
    loadAccountingLedgerOptions(form.voucher_type_id)
      .then((options) => {
        if (!ignore) setLedgerOptions(options);
      })
      .finally(() => {
        if (!ignore) setOptionsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [drawer, form.voucher_type_id, companyId]);

  useHotkeys(
    useMemo(
      () => ({
        "ctrl+n": () => canWrite && openNew(),
        "ctrl+s": () => drawer && canWrite && saveDraft(),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [canWrite, drawer, form]
    )
  );

  const filtered = vouchers.filter((voucher) => {
    const matchesType = typeFilter === "ALL" || voucher.voucherTypeId === typeFilter;
    const matchesStatus = statusFilter === "ALL" || voucher.voucherStatus === statusFilter;
    const text = `${voucher.voucherNo} ${voucher.voucherTypeName || ""} ${voucher.referenceNo || ""} ${voucher.narration || ""}`;
    return matchesType && matchesStatus && text.toLowerCase().includes(query.toLowerCase());
  });

  const totals = useMemo(() => {
    const debit = round2(
      form.lines
        .filter((line) => line.side === "DEBIT")
        .reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    );
    const credit = round2(
      form.lines
        .filter((line) => line.side === "CREDIT")
        .reduce((sum, line) => sum + (Number(line.amount) || 0), 0)
    );
    return { debit, credit, difference: round2(debit - credit) };
  }, [form.lines]);

  const bankCashLedgers = useMemo(() => {
    return ledgers.filter((l) => {
      const cat = (l.category || "").toLowerCase();
      const nm = (l.name || "").toLowerCase();
      return l.is_bank === "Y" || l.is_cash === "Y" || cat === "bank" || cat === "cash" || nm.includes("bank") || nm.includes("cash");
    });
  }, [ledgers]);

  const readOnly = !!form.id && form.status !== "DRAFT";

  function openNew() {
    setForm(emptyForm());
    setSubmitted(false);
    setLedgerOptions(null);
    setDrawer(true);
  }

  function openEdit(voucher: Voucher) {
    const details = voucher.details || [];
    const foundParty = parties.find((p) => p.ledger_id && details.some((d) => d.ledgerId === p.ledger_id));
    setForm({
      id: voucher.id,
      status: voucher.voucherStatus,
      voucher_no: voucher.voucherNo,
      voucher_type_id: voucher.voucherTypeId || "",
      voucher_type_name: voucher.voucherTypeName || voucher.baseVoucherType,
      base_voucher_type: voucher.baseVoucherType,
      voucher_date: voucher.voucherDate,
      due_date: voucher.dueDate ? voucher.dueDate.slice(0, 10) : "",
      party_id: foundParty?.id || "",
      reference_no: voucher.referenceNo || "",
      reference_date: (voucher as any).referenceDate ? (voucher as any).referenceDate.slice(0, 10) : "",
      narration: voucher.narration || "",
      lines: details.map((detail, index) => {
        const debit = Number(detail.debitAmount) || 0;
        return {
          line_no: detail.lineNo || index + 1,
          side: debit > 0 ? "DEBIT" : "CREDIT",
          ledger_id: detail.ledgerId || "",
          ledger_name: detail.ledgerName || "",
          amount: debit || Number(detail.creditAmount) || 0,
          remarks: detail.remarks || "",
        };
      }),
    });
    setSubmitted(false);
    setDrawer(true);
  }

  function isPartyVoucherType(baseType: string): boolean {
    const bt = (baseType || "").toUpperCase();
    return bt === "SALES" || bt === "PURCHASE" || bt === "CREDIT_NOTE" || bt === "DEBIT_NOTE";
  }

  function isBankCashVoucherType(baseType: string): boolean {
    const bt = (baseType || "").toUpperCase();
    return bt === "PAYMENT" || bt === "RECEIPT" || bt === "CONTRA";
  }

  function getVoucherSides(baseType: string): { topSide: EntrySide; oppositeSide: EntrySide } {
    const bt = (baseType || "").toUpperCase();
    if (bt === "SALES" || bt === "DEBIT_NOTE") {
      return { topSide: "DEBIT", oppositeSide: "CREDIT" };
    }
    if (bt === "PURCHASE" || bt === "CREDIT_NOTE") {
      return { topSide: "CREDIT", oppositeSide: "DEBIT" };
    }
    if (bt === "RECEIPT") {
      return { topSide: "DEBIT", oppositeSide: "CREDIT" };
    }
    if (bt === "PAYMENT" || bt === "CONTRA") {
      return { topSide: "CREDIT", oppositeSide: "DEBIT" };
    }
    return { topSide: "DEBIT", oppositeSide: "CREDIT" };
  }

  function autoBalancePartyLine(currentLines: AccountingLine[], baseType: string, partyId: string): AccountingLine[] {
    if (!partyId) return currentLines;
    const bt = (baseType || "").toUpperCase();

    // 1. Party Vouchers (Sales, Purchase, Credit Note, Debit Note)
    if (isPartyVoucherType(bt)) {
      const party = parties.find((p) => p.id === partyId);
      if (!party || !party.ledger_id) return currentLines;

      const { topSide, oppositeSide } = getVoucherSides(bt);
      const partyName = (party.name_contact_info as any)?.name || (party.name_contact_info as any)?.company_name || party.ledger_id;

      let partyLine = currentLines.find((l) => l.ledger_id === party.ledger_id);
      let nonPartyLines = currentLines.filter((l) => l.ledger_id !== party.ledger_id);

      const nonPartySum = round2(
        nonPartyLines
          .filter((l) => l.side === oppositeSide)
          .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
      );

      const line1: AccountingLine = {
        line_no: 1,
        side: topSide,
        ledger_id: party.ledger_id!,
        ledger_name: partyLine?.ledger_name || partyName,
        amount: partyLine?.amount || nonPartySum,
        remarks: partyLine?.remarks || "",
      };

      let updatedNonParty = nonPartyLines.map((l, idx) => ({
        ...l,
        line_no: idx + 2,
        side: idx === 0 && (l.side === topSide || !l.ledger_id) ? oppositeSide : l.side,
      }));

      if (updatedNonParty.length === 0) {
        updatedNonParty = [emptyLine(2, oppositeSide)];
      }

      return [line1, ...updatedNonParty];
    }

    // 2. Bank / Cash Vouchers (Payment, Receipt, Contra)
    if (isBankCashVoucherType(bt)) {
      const targetLedger = ledgers.find((l) => l.id === partyId) || parties.find((p) => p.id === partyId || p.ledger_id === partyId);
      const ledgerId = targetLedger ? (targetLedger as any).ledger_id || targetLedger.id : partyId;
      const ledgerName = targetLedger ? (targetLedger as any).name || (targetLedger as any).name_contact_info?.name || ledgerId : ledgerId;

      const { topSide, oppositeSide } = getVoucherSides(bt);

      let bankCashLine = currentLines.find((l) => l.ledger_id === ledgerId);
      let otherLines = currentLines.filter((l) => l.ledger_id !== ledgerId);

      const otherSum = round2(
        otherLines
          .filter((l) => l.side === oppositeSide)
          .reduce((sum, l) => sum + (Number(l.amount) || 0), 0)
      );

      const line1: AccountingLine = {
        line_no: 1,
        side: topSide,
        ledger_id: ledgerId,
        ledger_name: bankCashLine?.ledger_name || ledgerName,
        amount: bankCashLine?.amount || otherSum,
        remarks: bankCashLine?.remarks || "",
      };

      let updatedOthers = otherLines.map((l, idx) => ({
        ...l,
        line_no: idx + 2,
        side: idx === 0 && (l.side === topSide || !l.ledger_id) ? oppositeSide : l.side,
      }));

      if (updatedOthers.length === 0) {
        updatedOthers = [emptyLine(2, oppositeSide)];
      }

      return [line1, ...updatedOthers];
    }

    return currentLines;
  }

  function selectParty(partyId: string) {
    setForm((current) => {
      let newLines = current.lines;
      if (partyId) {
        newLines = autoBalancePartyLine(current.lines, current.base_voucher_type, partyId);
      }
      return {
        ...current,
        party_id: partyId,
        lines: newLines,
      };
    });
  }

  function selectVoucherType(voucherTypeId: string) {
    const selected = voucherTypes.find((type) => type.id === voucherTypeId);
    setForm((current) => {
      const baseType = selected?.base_voucher_type || "";
      let updatedLines = current.lines.map((line) => ({
        ...line,
        ledger_id: "",
        ledger_name: "",
      }));
      if (current.party_id && (isPartyVoucherType(baseType) || isBankCashVoucherType(baseType))) {
        updatedLines = autoBalancePartyLine(updatedLines, baseType, current.party_id);
      } else if (isPartyVoucherType(baseType) || isBankCashVoucherType(baseType)) {
        const { topSide, oppositeSide } = getVoucherSides(baseType);
        updatedLines = [emptyLine(1, topSide), emptyLine(2, oppositeSide)];
      }
      return {
        ...current,
        voucher_type_id: voucherTypeId,
        voucher_type_name: selected?.name || "",
        base_voucher_type: baseType,
        lines: updatedLines,
      };
    });
  }

  function updateLine(index: number, patch: Partial<AccountingLine>) {
    setForm((current) => {
      const updatedLines = current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line
      );
      const balancedLines = autoBalancePartyLine(
        updatedLines,
        current.base_voucher_type,
        current.party_id
      );
      return {
        ...current,
        lines: balancedLines,
      };
    });
  }

  function addLine() {
    const nextSide: EntrySide = totals.debit <= totals.credit ? "DEBIT" : "CREDIT";
    setForm((current) => {
      const updatedLines = [...current.lines, emptyLine(current.lines.length + 1, nextSide)];
      return {
        ...current,
        lines: autoBalancePartyLine(updatedLines, current.base_voucher_type, current.party_id),
      };
    });
  }

  function removeLine(index: number) {
    setForm((current) => {
      const updatedLines = current.lines
        .filter((_, lineIndex) => lineIndex !== index)
        .map((line, lineIndex) => ({ ...line, line_no: lineIndex + 1 }));
      return {
        ...current,
        lines: autoBalancePartyLine(updatedLines, current.base_voucher_type, current.party_id),
      };
    });
  }

  function fillFormFromAi(draft: AiDraft) {
    const f = draft.fields;
    const grand = Math.round((Number(f.grand_total) || 0) * 100) / 100;
    const ref = (f.invoice_no || "").slice(0, 50);
    setForm((current) => ({
      ...current,
      reference_no: ref,
      voucher_date: f.invoice_date || current.voucher_date,
      narration: (f.narration || "").slice(0, 50),
      lines: [
        { ...emptyLine(1, "DEBIT"), amount: grand, remarks: ref.slice(0, 30) },
        { ...emptyLine(2, "CREDIT"), amount: grand, remarks: ref.slice(0, 30) },
      ],
    }));
  }

  function optionsFor(line: AccountingLine): AccountingLedgerOption[] {
    const options = line.side === "DEBIT" ? ledgerOptions?.debit || [] : ledgerOptions?.credit || [];
    const used = new Set(
      form.lines
        .filter((candidate) => candidate.line_no !== line.line_no && candidate.ledger_id)
        .map((candidate) => candidate.ledger_id)
    );
    return options.filter((option) => option.id === line.ledger_id || !used.has(option.id));
  }

  function groupLedgerOptions(options: AccountingLedgerOption[], selectedId?: string) {
    const seenKey = new Set<string>();
    const uniqueOptions: AccountingLedgerOption[] = [];

    if (selectedId) {
      const selectedOpt = options.find((o) => o.id === selectedId);
      if (selectedOpt) {
        const key = `${(selectedOpt.name || "").trim().toLowerCase()}|${(selectedOpt.groupName || "").trim().toLowerCase()}`;
        seenKey.add(key);
        uniqueOptions.push(selectedOpt);
      }
    }

    for (const opt of options) {
      if (selectedId && opt.id === selectedId) continue;
      const key = `${(opt.name || "").trim().toLowerCase()}|${(opt.groupName || "").trim().toLowerCase()}`;
      if (!seenKey.has(key)) {
        seenKey.add(key);
        uniqueOptions.push(opt);
      }
    }

    const groups: Record<string, AccountingLedgerOption[]> = {};
    for (const opt of uniqueOptions) {
      const groupName = opt.groupName || "Other Accounts";
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(opt);
    }
    return groups;
  }

  function validate(): boolean {
    setSubmitted(true);
    if (!form.voucher_date || !form.voucher_type_id) return false;
    if (form.due_date && form.voucher_date && form.due_date < form.voucher_date) {
      toast({ title: "Due date cannot be earlier than voucher date", tone: "error" });
      return false;
    }
    if (form.lines.length < 2) {
      toast({ title: "At least two voucher lines are required", tone: "error" });
      return false;
    }
    if (form.lines.some((line) => !line.ledger_id || !(Number(line.amount) > 0))) {
      toast({ title: "Every line needs an account and amount", tone: "error" });
      return false;
    }
    if (!form.lines.some((line) => line.side === "DEBIT") || !form.lines.some((line) => line.side === "CREDIT")) {
      toast({ title: "Enter at least one debit and one credit line", tone: "error" });
      return false;
    }
    const ledgerIds = form.lines.map((line) => line.ledger_id);
    if (new Set(ledgerIds).size !== ledgerIds.length) {
      toast({ title: "The same ledger cannot be repeated", tone: "error" });
      return false;
    }
    if (totals.debit <= 0 || Math.abs(totals.difference) > 0.009) {
      toast({ title: "Debit and credit totals must be equal", tone: "error" });
      return false;
    }
    return true;
  }

  async function persist(): Promise<string | null> {
    if (!validate()) return null;
    setSaving(true);
    const payload = {
      voucher_type_id: form.voucher_type_id || null,
      voucher_date: form.voucher_date,
      due_date: form.due_date || null,
      reference_no: form.reference_no.trim() || null,
      reference_date: form.reference_date ? form.reference_date.slice(0, 10) : null,
      narration: form.narration.trim() || null,
      details: form.lines.map((line, index) => ({
        line_no: index + 1,
        ledger_id: line.ledger_id,
        debit_amount: line.side === "DEBIT" ? Number(line.amount) : 0,
        credit_amount: line.side === "CREDIT" ? Number(line.amount) : 0,
        remarks: line.remarks.trim() || null,
      })),
    };
    const response = form.id
      ? await api.put(`/vouchers/${form.id}`, payload)
      : await api.post(
          `/vouchers?voucher_type_id=${encodeURIComponent(form.voucher_type_id)}`,
          payload
        );
    setSaving(false);
    if (!envelopeOk(response)) {
      toast({ title: "Could not save voucher", desc: envelopeMessage(response), tone: "error" });
      return null;
    }
    return form.id || envelopeResult<{ id: string }>(response)?.id || null;
  }

  async function revealVoucher(id: string) {
    await load();
    const response = await api.get(`/vouchers/${id}`);
    const voucher = envelopeResult<Voucher>(response);
    if (voucher) openEdit(voucher);
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
    const response = await api.patch(`/vouchers/${id}/post`, {});
    if (!envelopeOk(response)) {
      toast({ title: "Could not post voucher", desc: envelopeMessage(response), tone: "error" });
      return;
    }
    toast({ title: "Voucher posted", tone: "success" });
    await revealVoucher(id);
  }

  async function deleteVoucher() {
    if (!toDelete) return;
    const response = await api.del(`/vouchers/${toDelete.id}`);
    if (!envelopeOk(response)) {
      toast({ title: "Could not delete voucher", desc: envelopeMessage(response), tone: "error" });
      return;
    }
    toast({ title: "Voucher deleted", desc: toDelete.voucherNo, tone: "success" });
    if (form.id === toDelete.id) setDrawer(false);
    load();
  }

  return (
    <PageHeader
      title="Accounting Voucher"
      sub="Account-only voucher entry across every configured Voucher Type"
      actions={
        canWrite && (
          <Button size="sm" onClick={openNew} title="Ctrl+N">
            <Plus className="h-4 w-4" />
            Add Voucher
          </Button>
        )
      }
    >
      <Panel
        pad={false}
        title={`${filtered.length} vouchers`}
        right={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Select className="h-9 w-full bg-card sm:w-44" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="ALL">All Voucher Types</option>
              {voucherTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
            <Select className="h-9 w-full bg-card sm:w-32" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <SearchBox value={query} onChange={setQuery} placeholder="Search voucher ID or type" />
          </div>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th className="w-16">S.No</Th>
                <Th>Voucher ID</Th>
                <Th>Voucher Type</Th>
                <Th>Date</Th>
                <Th right>Amount</Th>
                <Th className="w-28">Status</Th>
                <Th className="w-36" right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={7} text="No accounting vouchers found." />}
              {filtered.map((voucher, index) => (
                <tr key={voucher.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => openEdit(voucher)}>
                  <Td className="mono text-muted-foreground">{index + 1}</Td>
                  <Td className="mono font-medium">{voucher.voucherNo}</Td>
                  <Td>{voucher.voucherTypeName || voucher.baseVoucherType}</Td>
                  <Td>{fmtDate(voucher.voucherDate)}</Td>
                  <Td right><Money v={voucher.totalDebit || 0} /></Td>
                  <Td>
                    <Badge tone={voucher.voucherStatus === "POSTED" ? "ok" : voucher.voucherStatus === "DRAFT" ? "warn" : "bad"}>
                      {voucher.voucherStatus}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      {canWrite && (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(event) => { event.stopPropagation(); openEdit(voucher); }}>
                          Edit
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={(event) => { event.stopPropagation(); setToDelete(voucher); }}>
                          Delete
                        </Button>
                      )}
                    </div>
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
        title={form.id ? `${form.voucher_no} · ${form.voucher_type_name} · ${form.status}` : "Add Accounting Voucher"}
        desc={form.id ? form.reference_no || undefined : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>Close</Button>
            {!readOnly && canWrite && (
              <>
                <Button variant="secondary" onClick={saveDraft} disabled={saving}>Save draft</Button>
                <Button onClick={saveAndPost} disabled={saving}>
                  <CheckCircle className="h-4 w-4" />
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
            <AiFillPanel target="ACCOUNTING" onApply={fillFormFromAi} liveGrandTotal={totals.debit} />
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {form.id && (
            <Field label="Voucher ID">
              <Input className="mono" disabled value={form.voucher_no} />
            </Field>
          )}
          <Field label="Voucher Type" required error={submitted && !form.voucher_type_id ? "Required" : undefined}>
            <Select disabled={!!form.id} value={form.voucher_type_id} onChange={(event) => selectVoucherType(event.target.value)}>
              <option value="">Select Voucher Type</option>
              {form.voucher_type_id && !voucherTypes.some((type) => type.id === form.voucher_type_id) && (
                <option value={form.voucher_type_id}>{form.voucher_type_name || "Historical Voucher Type"}</option>
              )}
              {voucherTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Voucher Date" required error={submitted && !form.voucher_date ? "Required" : undefined}>
            <DatePicker
              disabled={readOnly}
              value={form.voucher_date}
              onChange={(vDate) => {
                let computedDue = form.due_date;
                if (form.base_voucher_type === "SALES" || form.base_voucher_type === "PURCHASE") {
                  const partyLine = form.lines.find((l) => l.ledger_id);
                  if (partyLine) {
                    const lObj = ledgers.find((l) => l.id === partyLine.ledger_id);
                    const pObj = parties.find((p) => p.ledger_id === partyLine.ledger_id);
                    const terms = lObj?.payment_terms || pObj?.payment_info?.terms;
                    if (terms) {
                      computedDue = computeDueDate(vDate, terms);
                    }
                  }
                }
                setForm({ ...form, voucher_date: vDate, due_date: computedDue });
              }}
            />
          </Field>
          <Field label={
            form.base_voucher_type === "SALES" || form.base_voucher_type === "CREDIT_NOTE"
              ? "Party (Customer)"
              : form.base_voucher_type === "PURCHASE" || form.base_voucher_type === "DEBIT_NOTE"
              ? "Party (Vendor)"
              : isBankCashVoucherType(form.base_voucher_type)
              ? "Bank / Cash Account"
              : "Party / Account (Optional)"
          }>
            <Select disabled={readOnly} value={form.party_id} onChange={(event) => selectParty(event.target.value)}>
              <option value="">
                {isBankCashVoucherType(form.base_voucher_type)
                  ? "Select Bank / Cash Account"
                  : "Select Party (Optional)"}
              </option>
              {isBankCashVoucherType(form.base_voucher_type)
                ? bankCashLedgers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.is_bank === "Y" || (l.category || "").toLowerCase() === "bank" ? "Bank" : "Cash"})
                    </option>
                  ))
                : parties
                    .filter((p) => {
                      if (form.base_voucher_type === "SALES" || form.base_voucher_type === "CREDIT_NOTE") return p.key_group === "C";
                      if (form.base_voucher_type === "PURCHASE" || form.base_voucher_type === "DEBIT_NOTE") return p.key_group === "V";
                      return true;
                    })
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {(p.name_contact_info as any)?.name || (p.name_contact_info as any)?.company_name || p.id} {p.gstin ? `(${p.gstin})` : ""}
                      </option>
                    ))}
            </Select>
          </Field>
          {(form.base_voucher_type === "SALES" || form.base_voucher_type === "PURCHASE") && (
            <Field label="Due Date" error={submitted && form.due_date && form.voucher_date && form.due_date < form.voucher_date ? "Earlier than voucher date" : undefined}>
              <DatePicker min={form.voucher_date} disabled={readOnly} value={form.due_date} onChange={(val) => setForm({ ...form, due_date: val })} />
            </Field>
          )}
          <Field label={form.base_voucher_type === "CREDIT_NOTE" || form.base_voucher_type === "DEBIT_NOTE" ? "Original Invoice ID" : "Reference No."}>
            <Input className="mono" maxLength={50} placeholder="Optional (e.g. Inv #, Ref #)" disabled={readOnly} value={form.reference_no} onChange={(event) => setForm({ ...form, reference_no: event.target.value })} />
          </Field>
          {(form.base_voucher_type === "CREDIT_NOTE" || form.base_voucher_type === "DEBIT_NOTE") && (
            <Field label="Original Invoice Date">
              <DatePicker max={form.voucher_date} disabled={readOnly} value={form.reference_date} onChange={(val) => setForm({ ...form, reference_date: val })} />
            </Field>
          )}
        </div>

        <div className="mt-5 rounded-md border border-border overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13px]">
            <thead>
              <tr>
                <Th className="w-12">#</Th>
                <Th className="w-28">Side</Th>
                <Th>Ledger Account</Th>
                <Th right className="w-36">Amount</Th>
                <Th className="w-44">Remarks</Th>
                <Th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {form.lines.map((line, index) => {
                const eligible = optionsFor(line);
                const currentIsEligible = eligible.some((option) => option.id === line.ledger_id);
                return (
                  <tr key={line.line_no} className="align-top">
                    <Td className="mono text-muted-foreground">{index + 1}</Td>
                    <Td>
                      <Select
                        className="h-8"
                        disabled={readOnly}
                        value={line.side}
                        onChange={(event) => updateLine(index, {
                          side: event.target.value as EntrySide,
                          ledger_id: "",
                          ledger_name: "",
                        })}
                      >
                        <option value="DEBIT">Debit</option>
                        <option value="CREDIT">Credit</option>
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        className={"h-8 " + (submitted && !line.ledger_id ? "border-destructive" : "")}
                        disabled={readOnly || !form.voucher_type_id || optionsLoading}
                        value={line.ledger_id}
                        onChange={(event) => {
                          const selectedId = event.target.value;
                          const selected = eligible.find((option) => option.id === selectedId);
                          let computedDue = form.due_date;
                          if (selectedId && (form.base_voucher_type === "SALES" || form.base_voucher_type === "PURCHASE")) {
                            const lObj = ledgers.find((l) => l.id === selectedId);
                            const pObj = parties.find((p) => p.ledger_id === selectedId);
                            const terms = lObj?.payment_terms || pObj?.payment_info?.terms;
                            if (terms) {
                              computedDue = computeDueDate(form.voucher_date, terms);
                            }
                          }
                          setForm((f) => ({
                            ...f,
                            due_date: computedDue,
                            lines: f.lines.map((l, idx) => (idx === index ? { ...l, ledger_id: selectedId, ledger_name: selected?.name || "" } : l)),
                          }));
                        }}
                      >
                        <option value="">{optionsLoading ? "Loading accounts..." : "Select account"}</option>
                        {line.ledger_id && !currentIsEligible && (
                          <option value={line.ledger_id}>{line.ledger_name || "Historical ledger"}</option>
                        )}
                        {Object.entries(groupLedgerOptions(eligible, line.ledger_id)).map(([groupName, groupOptions]) => (
                          <optgroup key={groupName} label={groupName}>
                            {groupOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.name}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </Select>
                    </Td>
                    <Td right>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className={"h-8 text-right fig " + (submitted && !(Number(line.amount) > 0) ? "border-destructive" : "")}
                        disabled={readOnly}
                        value={line.amount || ""}
                        onChange={(event) => updateLine(index, { amount: Number(event.target.value) || 0 })}
                      />
                    </Td>
                    <Td>
                      <Input className="h-8" maxLength={30} disabled={readOnly} value={line.remarks} onChange={(event) => updateLine(index, { remarks: event.target.value })} />
                    </Td>
                    <Td>
                      {!readOnly && form.lines.length > 2 && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeLine(index)} title="Remove line">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="ledger-rule-strong bg-muted/40">
                <td colSpan={3} className="px-4 py-2.5 text-right text-[11px] uppercase font-semibold text-muted-foreground">Totals</td>
                <td className="px-4 py-2.5 text-right fig font-medium">Dr {money(totals.debit)} · Cr {money(totals.credit)}</td>
                <td colSpan={2} className="px-4 py-2.5 text-[12px] font-semibold">
                  {Math.abs(totals.difference) > 0.009 ? (
                    <span className="text-destructive">Difference {money(Math.abs(totals.difference))}</span>
                  ) : totals.debit > 0 ? (
                    <span className="text-[var(--teal)]">Balanced</span>
                  ) : (
                    <span className="text-muted-foreground">Enter amounts</span>
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!readOnly && (
          <Button variant="outline" size="sm" className="mt-3" onClick={addLine}>
            <Plus className="h-4 w-4" />
            Add line
          </Button>
        )}

        <Field label="Narration" className="mt-4">
          <Textarea maxLength={50} disabled={readOnly} value={form.narration} onChange={(event) => setForm({ ...form, narration: event.target.value })} />
        </Field>
      </Drawer>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete ${toDelete?.voucherNo}?`}
        desc="The voucher will be deactivated and retained in the audit trail."
        confirmLabel="Delete voucher"
        onConfirm={deleteVoucher}
      />
    </PageHeader>
  );
}