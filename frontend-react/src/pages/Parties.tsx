import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Download, Upload, Trash2, Settings } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { money } from "../lib/format";
import { quickPanHint, type Hint } from "../lib/gst";
import { downloadCSV } from "../lib/csv";
import { useHotkeys } from "../lib/hotkeys";
import { ActivityDrawer } from "../components/ActivityDrawer";
import { ImportDialog } from "../components/ImportDialog";
import {
  Button,
  Checkbox,
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
  RowActions,
  Drawer,
  ConfirmDialog,
  Spinner,
  ValidationHint,
} from "../components/ui";

interface Party {
  id: string;
  name_contact_info: any;
  address_info: any;
  payment_info: any;
  additional_info: any;
  gstin: string | null;
  pan: string | null;
  gst_type: string | null;
  active: string;
  key_group: string;
  ledger_id: string | null;
}

interface ContactPerson {
  name: string;
  designation: string;
  email: string;
  mobile: string;
}
interface ExtraAddress {
  label: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
}

function emptyForm() {
  return {
    id: null as string | null,
    key_group: "" as string,
    title: "",
    first_name: "",
    last_name: "",
    company_name: "",
    display_name: "",
    email: "",
    mobile_number: "",
    website: "",
    gstin: "",
    pan: "",
    gst_type: "",
    b_line1: "",
    b_line2: "",
    b_city: "",
    b_state: "",
    b_country: "India",
    b_pincode: "",
    s_line1: "",
    s_line2: "",
    s_city: "",
    s_state: "",
    s_country: "India",
    s_pincode: "",
    same_as_billing: true,
    payment_method: "",
    terms: "",
    credit_limit: "",
    opening_bal: "",
    date: "",
    customer_type: "",
    contact_persons: [] as ContactPerson[],
    extra_addresses: [] as ExtraAddress[],
  };
}
type FormT = ReturnType<typeof emptyForm>;

export function Parties({ kind }: { kind: "C" | "V" }) {
  const label = kind === "C" ? "customer" : "vendor";
  const Title = kind === "C" ? "Customer Master" : "Vendor Master";
  const feature = kind === "C" ? "CUSTOMER" : "VENDOR";
  const { can } = useAuth();
  const { toast } = useToast();
  const loc = useLocation();
  const nav = useNavigate();
  const canWrite = can(feature, "write");
  const canDelete = can(feature, "delete");

  const [rows, setRows] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState((loc.state as any)?.search || "");
  const [gstFilter, setGstFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState<"active" | "all">("active");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<FormT>(emptyForm());
  const [submitted, setSubmitted] = useState(false);
  const [toDelete, setToDelete] = useState<Party | null>(null);
  const [auditFor, setAuditFor] = useState<Party | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [nameHint, setNameHint] = useState<Hint | null>(null);
  const [gstinHint, setGstinHint] = useState<Hint | null>(null);
  const [outstanding, setOutstanding] = useState<any | null>(null);
  const [history, setHistory] = useState<any[] | null>(null);
  const [quickPanelFor, setQuickPanelFor] = useState<Party | null>(null);
  const [paymentTermsOptions, setPaymentTermsOptions] = useState<Array<{ text: string; value: string }>>([]);
  const [paymentMethodOptions, setPaymentMethodOptions] = useState<Array<{ text: string; value: string }>>([]);
  const [titleOptions, setTitleOptions] = useState<Array<{ text: string; value: string }>>([]);
  const [partyTypeOptions, setPartyTypeOptions] = useState<Array<{ text: string; value: string }>>([]);
  const [gstTypeOptions, setGstTypeOptions] = useState<Array<{ text: string; value: string }>>([]);

  async function load() {
    setLoading(true);
    const inc = statusFilter === "all" ? "&include_inactive=true" : "";
    const r = await api.get(`/parties?key_group=${kind}${inc}`);
    setRows(envelopeResult<Party[]>(r) || []);
    setLoading(false);
  }

  useEffect(() => {
    async function loadLovs() {
      const [termsRes, methodsRes, gstTypeRes, titleRes, partyTypeRes] = await Promise.all([
        api.get("/lov/fetchLovGroupByCode/PAYMENT_TERMS"),
        api.get("/lov/fetchLovGroupByCode/PAYMENT_METHODS"),
        api.get("/lov/fetchLovGroupByCode/GST_TYPE"),
        api.get("/lov/fetchLovGroupByCode/TITLE"),
        api.get("/lov/fetchLovGroupByCode/PARTY_TYPE"),
      ]);
      const termsList = envelopeResult<any[]>(termsRes);
      if (termsList && termsList.length) {
        setPaymentTermsOptions(termsList.map((item) => ({ text: item.text || item.key_txt, value: item.text || item.key_txt })));
      }

      const methodsList = envelopeResult<any[]>(methodsRes);
      if (methodsList && methodsList.length) {
        setPaymentMethodOptions(methodsList.map((item) => ({ text: item.text || item.key_txt, value: item.text || item.key_txt })));
      }

      const gstList = envelopeResult<any[]>(gstTypeRes);
      if (gstList && gstList.length) {
        setGstTypeOptions(gstList.map((item) => ({ text: item.text || item.key_txt, value: item.key_txt || item.text })));
      }

      const titleList = envelopeResult<any[]>(titleRes);
      if (titleList && titleList.length) {
        setTitleOptions(titleList.map((item) => ({ text: item.text || item.key_txt, value: item.key_txt || item.text })));
      }

      const partyTypeList = envelopeResult<any[]>(partyTypeRes);
      if (partyTypeList && partyTypeList.length) {
        setPartyTypeOptions(partyTypeList.map((item) => ({ text: item.text || item.key_txt, value: item.key_txt || item.text })));
      }
    }
    loadLovs();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, statusFilter]);

  useEffect(() => {
    if ((loc.state as any)?.openNew && canWrite) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useHotkeys(
    useMemo(
      () => ({
        "ctrl+n": () => canWrite && openNew(),
        "ctrl+s": () => drawer && save(false),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [drawer, form, canWrite]
    )
  );

  // Live duplicate + GSTIN validation.
  useEffect(() => {
    if (!drawer) return;
    const t = setTimeout(async () => {
      const nameToCheck = form.company_name.trim() || [form.first_name, form.last_name].filter(Boolean).join(" ").trim();
      if (!nameToCheck && !form.gstin) return;
      const r = await api.post("/parties/validate", {
        id: form.id,
        name: nameToCheck || null,
        gstin: form.gstin || null,
        key_group: kind,
      });
      const res = envelopeResult<any>(r);
      if (res?.name) setNameHint(res.name);
      if (res?.gstin) setGstinHint({ level: res.gstin.level, message: res.gstin.message });
      else if (!form.gstin) setGstinHint(null);
    }, 350);
    return () => clearTimeout(t);
  }, [form.company_name, form.first_name, form.last_name, form.gstin, form.id, drawer, kind]);

  const panHint = quickPanHint(form.pan);

  const filtered = useMemo(
    () =>
      rows.filter((p) => {
        const n = p.name_contact_info || {};
        const matchQ = `${n.display_name || ""} ${n.company_name || ""} ${n.mobile_number || ""} ${p.gstin || ""}`
          .toLowerCase()
          .includes(q.toLowerCase());
        const matchGst =
          gstFilter === "ALL" ||
          (gstFilter === "REGISTERED" && !!p.gstin) ||
          (gstFilter === "MISSING" && !p.gstin);
        const matchType =
          typeFilter === "ALL" ||
          (typeFilter === "BOTH" && p.key_group === "B") ||
          (typeFilter === "PURE" && p.key_group !== "B");
        return matchQ && matchGst && matchType;
      }),
    [rows, q, gstFilter, typeFilter]
  );

  function openNew() {
    setForm({ ...emptyForm(), key_group: kind });
    setSubmitted(false);
    setNameHint(null);
    setGstinHint(null);
    setDrawer(true);
  }
  function openEdit(p: Party) {
    const n = p.name_contact_info || {};
    const b = p.address_info?.billing_address || {};
    const s = p.address_info?.shipping_address || {};
    const pay = p.payment_info || {};
    const add = p.additional_info || {};
    setForm({
      id: p.id,
      key_group: p.key_group,
      title: n.title || "",
      first_name: n.first_name || "",
      last_name: n.last_name || "",
      company_name: n.company_name || "",
      display_name: n.display_name || "",
      email: n.email || "",
      mobile_number: n.mobile_number || "",
      website: n.website || "",
      gstin: p.gstin || "",
      pan: p.pan || "",
      gst_type: p.gst_type || "",
      b_line1: b.address_line1 || "",
      b_line2: b.address_line2 || "",
      b_city: b.city || "",
      b_state: b.state || "",
      b_country: b.country || "India",
      b_pincode: b.pincode || "",
      s_line1: s.address_line1 || "",
      s_line2: s.address_line2 || "",
      s_city: s.city || "",
      s_state: s.state || "",
      s_country: s.country || "India",
      s_pincode: s.pincode || "",
      same_as_billing: p.address_info?.same_as_billing !== false,
      payment_method: pay.payment_method || "",
      terms: pay.terms || "",
      credit_limit: pay.credit_limit != null ? String(pay.credit_limit) : "",
      opening_bal: add.opening_bal != null ? String(add.opening_bal) : "",
      date: add.date || "",
      customer_type: add.customer_type || "",
      contact_persons: (n.contact_persons || []).map((c: any) => ({
        name: c.name || "",
        designation: c.designation || "",
        email: c.email || "",
        mobile: c.mobile || "",
      })),
      extra_addresses: (p.address_info?.additional_addresses || []).map((a: any) => ({
        label: a.label || "",
        address_line1: a.address_line1 || "",
        address_line2: a.address_line2 || "",
        city: a.city || "",
        state: a.state || "",
        country: a.country || "India",
        pincode: a.pincode || "",
      })),
    });
    setSubmitted(false);
    setNameHint(null);
    setGstinHint(null);
    setDrawer(true);
  }

  async function openQuickPanel(p: Party) {
    setQuickPanelFor(p);
    setOutstanding(null);
    setHistory(null);
    const r = await api.get(`/parties/${p.id}/outstanding`);
    setOutstanding(envelopeResult<any>(r));
    if (p.ledger_id) {
      const hr = await api.get(`/vouchers/ledger/${p.ledger_id}`);
      setHistory(envelopeResult<any[]>(hr) || []);
    } else {
      setHistory([]);
    }
  }

  async function save(andNew: boolean) {
    setSubmitted(true);
    const company = form.company_name.trim();
    const fullName = [form.first_name, form.last_name].filter(Boolean).join(" ").trim();
    const effectiveDisplay = company || fullName || "Party Account";
    if (!company) return;
    const addr = (pre: "b" | "s") => ({
      address_line1: (form as any)[pre + "_line1"] || null,
      address_line2: (form as any)[pre + "_line2"] || null,
      city: (form as any)[pre + "_city"] || null,
      state: (form as any)[pre + "_state"] || null,
      country: (form as any)[pre + "_country"] || null,
      pincode: (form as any)[pre + "_pincode"] || null,
    });
    const payload = {
      key_group: form.key_group || kind,
      active: "Y",
      gstin: form.gstin ? form.gstin.toUpperCase() : null,
      pan: form.pan ? form.pan.toUpperCase() : null,
      gst_type: form.gst_type || null,
      name_contact_info: {
        title: form.title || null,
        first_name: form.first_name,
        last_name: form.last_name || null,
        company_name: form.company_name || null,
        display_name: effectiveDisplay,
        email: form.email || null,
        mobile_number: form.mobile_number || null,
        website: form.website || null,
        contact_persons: form.contact_persons
          .filter((c) => c.name.trim())
          .map((c) => ({
            name: c.name,
            designation: c.designation || null,
            email: c.email || null,
            mobile: c.mobile || null,
          })),
      },
      address_info: {
        billing_address: addr("b"),
        shipping_address: form.same_as_billing ? addr("b") : addr("s"),
        same_as_billing: form.same_as_billing,
        additional_addresses: form.extra_addresses
          .filter((a) => a.address_line1.trim() || a.label.trim())
          .map((a) => ({
            label: a.label || null,
            address_line1: a.address_line1 || null,
            address_line2: a.address_line2 || null,
            city: a.city || null,
            state: a.state || null,
            country: a.country || null,
            pincode: a.pincode || null,
          })),
      },
      payment_info: {
        payment_method: form.payment_method || null,
        terms: form.terms || null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : 0,
      },
      additional_info: {
        opening_bal: form.opening_bal ? Number(form.opening_bal) : 0,
        date: form.date || null,
        customer_type: form.customer_type || null,
      },
    };
    const r = form.id ? await api.put(`/parties/${form.id}`, payload) : await api.post("/parties", payload);
    if (!envelopeOk(r)) {
      toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({
      title: form.id ? `${label[0].toUpperCase() + label.slice(1)} updated` : `${label[0].toUpperCase() + label.slice(1)} created`,
      desc: form.display_name,
      tone: "success",
    });
    if (andNew) {
      setForm({ ...emptyForm(), key_group: kind });
      setSubmitted(false);
    } else setDrawer(false);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const r = await api.del(`/parties/${toDelete.id}`);
    if (!envelopeOk(r)) {
      toast({ title: "Could not delete", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: "Deactivated", desc: "Historical reports keep this party.", tone: "success" });
    load();
  }

  function exportCSV() {
    downloadCSV(
      `${label}s.csv`,
      ["name", "company", "gstin", "pan", "email", "mobile", "terms", "credit_limit", "opening_balance"],
      filtered.map((p) => {
        const n = p.name_contact_info || {};
        return [
          n.display_name || "",
          n.company_name || "",
          p.gstin || "",
          p.pan || "",
          n.email || "",
          n.mobile_number || "",
          p.payment_info?.terms || "",
          p.payment_info?.credit_limit || 0,
          p.additional_info?.opening_bal || 0,
        ];
      })
    );
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }

  async function bulkStatus(active: "Y" | "N") {
    const r = await api.post("/import/bulk-status", { entity: "PARTY", ids: [...selected], active });
    toast({ title: envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    setSelected(new Set());
    load();
  }

  async function bulkDelete() {
    if (!confirm(`Deactivate ${selected.size} selected ${label}(s)? They stay in historical reports.`)) return;
    const r = await api.post("/import/bulk-delete", { entity: "PARTY", ids: [...selected] });
    toast({ title: envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    setSelected(new Set());
    load();
  }

  const totalOpen = filtered.reduce((s, p) => s + (p.additional_info?.opening_bal || 0), 0);

  return (
    <PageHeader
      title={Title}
      sub={`${filtered.length} active · ${kind === "C" ? "receivable" : "payable"} exposure · linked ledgers auto-map to Sundry ${kind === "C" ? "Debtors" : "Creditors"}`}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
          {canWrite && (
            <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1.5" />
              Import
            </Button>
          )}
          {canWrite && (
            <Button size="sm" onClick={openNew} title="Ctrl+N">
              <Plus className="h-4 w-4 mr-1.5" />
              New {label}
            </Button>
          )}
          <Button size="sm" variant="ghost" title="Master settings (custom fields)" onClick={() => nav("/app/custom-fields")}>
            <Settings className="h-4 w-4" />
          </Button>
        </>
      }
    >
      {selected.size > 0 && (
        <div className="card-panel mb-4 px-4 py-2.5 flex items-center gap-3 fade-up">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkStatus("Y")}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulkStatus("N")}>Deactivate</Button>
          {canDelete && (
            <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:text-destructive" onClick={bulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_300px] gap-4 items-start">
        <Panel
          pad={false}
          title={
            <span>
              {kind === "C" ? "Receivable" : "Payable"} balance{" "}
              <span className="fig normal-case tracking-normal text-sm text-foreground ml-1">
                <Money v={totalOpen} />
              </span>
            </span>
          }
          right={
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 w-28 bg-card">
                <option value="ALL">All types</option>
                <option value="PURE">{kind === "C" ? "Customer only" : "Vendor only"}</option>
                <option value="BOTH">Both</option>
              </Select>
              <Select value={gstFilter} onChange={(e) => setGstFilter(e.target.value)} className="h-9 w-36 bg-card">
                <option value="ALL">All GST status</option>
                <option value="REGISTERED">GST registered</option>
                <option value="MISSING">GSTIN missing</option>
              </Select>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="h-9 w-32 bg-card">
                <option value="active">Active only</option>
                <option value="all">All statuses</option>
              </Select>
              <SearchBox value={q} onChange={setQ} placeholder={`Search ${label}s`} />
            </div>
          }
        >
          {loading ? (
            <Spinner />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th className="w-8" />
                  <Th>Name</Th>
                  <Th className="w-20">Type</Th>
                  <Th>GST</Th>
                  <Th>Contact</Th>
                  <Th>Terms</Th>
                  <Th right>Open balance</Th>
                  <Th className="w-20">Status</Th>
                  <Th className="w-44" right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <EmptyRow colSpan={9} text={`No ${label}s found.`} />}
                {filtered.map((p) => {
                  const n = p.name_contact_info || {};
                  return (
                    <tr key={p.id} className="hover:bg-muted/40">
                      <Td>
                        <Checkbox checked={selected.has(p.id)} onChange={(e) => toggleSelect(p.id, e.target.checked)} />
                      </Td>
                      <Td>
                        {(() => {
                          const comp = (n.company_name || "").trim();
                          const full = [n.first_name, n.last_name].filter(Boolean).join(" ").trim();
                          const primary = comp || full || n.display_name || "—";
                          const secondary = comp && full && full.toLowerCase() !== comp.toLowerCase() ? full : "";
                          return (
                            <>
                              <button className="font-medium text-[var(--teal)] hover:underline underline-offset-2 text-left" onClick={() => openQuickPanel(p)}>
                                {primary}
                              </button>
                              {secondary && (
                                <div className="text-[11.5px] text-muted-foreground">{secondary}</div>
                              )}
                            </>
                          );
                        })()}
                      </Td>
                      <Td>
                        <Badge tone={p.key_group === "B" ? "warn" : "muted"}>
                          {p.key_group === "B" ? "Both" : kind === "C" ? "Customer" : "Vendor"}
                        </Badge>
                      </Td>
                      <Td>
                        {p.gstin ? (
                          <span className="mono text-[11.5px]">{p.gstin}</span>
                        ) : (
                          <Badge tone="warn">Missing</Badge>
                        )}
                      </Td>
                      <Td>
                        <div>{n.mobile_number || "—"}</div>
                        <div className="text-[11.5px] text-muted-foreground">{n.email || ""}</div>
                      </Td>
                      <Td className="text-muted-foreground">{p.payment_info?.terms || "—"}</Td>
                      <Td right>
                        <Money v={p.additional_info?.opening_bal || 0} />
                      </Td>
                      <Td>
                        <Badge tone={p.active === "Y" ? "ok" : "muted"}>{p.active === "Y" ? "Active" : "Inactive"}</Badge>
                      </Td>
                      <Td>
                        <RowActions
                          canEdit={canWrite}
                          canDelete={canDelete}
                          onActivity={() => setAuditFor(p)}
                          onEdit={() => openEdit(p)}
                          onDelete={() => setToDelete(p)}
                        />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          )}
        </Panel>

        {/* Right quick panel: selected record summary + outstanding preview */}
        <div className="card-panel p-5 sticky top-[76px] hidden xl:block">
          <div className="eyebrow pb-3 ledger-rule">Quick panel</div>
          {!quickPanelFor ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Click a {label} name to preview outstanding balances and recent details here.
            </p>
          ) : (
            <div className="pt-3 space-y-3 fade-up">
              <div>
                <div className="font-semibold text-[15px]">{quickPanelFor.name_contact_info?.display_name}</div>
                <div className="text-[12px] text-muted-foreground">{quickPanelFor.name_contact_info?.company_name}</div>
                {quickPanelFor.gstin && <div className="mono text-[11.5px] mt-1">{quickPanelFor.gstin}</div>}
              </div>
              {outstanding ? (
                <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
                  {[
                    ["Opening balance", outstanding.opening_balance],
                    ["Posted debits", outstanding.debit],
                    ["Posted credits", outstanding.credit],
                    ["Net outstanding", outstanding.net_outstanding],
                  ].map(([l, v]) => (
                    <div key={String(l)} className="flex justify-between text-[12.5px]">
                      <span className="text-muted-foreground">{l}</span>
                      <span className="fig">{money(Number(v || 0))}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Spinner />
              )}
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                  Invoice / payment history
                </div>
                {history === null ? (
                  <div className="text-[12px] text-muted-foreground">Loading…</div>
                ) : history.length === 0 ? (
                  <div className="text-[12px] text-muted-foreground">No posted transactions yet.</div>
                ) : (
                  <ul className="divide-y divide-border/70 rounded-md border border-border">
                    {history.slice(0, 6).map((h: any, i: number) => (
                      <li key={i} className="flex items-center justify-between px-2.5 py-1.5 text-[12px]">
                        <div>
                          <span className="mono">{h.voucherNo}</span>
                          <span className="text-muted-foreground ml-1.5">{h.voucherType}</span>
                        </div>
                        <span className="fig">
                          {money((h.debitAmount || 0) - (h.creditAmount || 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {canWrite && (
                  <Button size="sm" variant="outline" onClick={() => openEdit(quickPanelFor)}>Edit</Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setAuditFor(quickPanelFor)}>Activity</Button>
                {quickPanelFor.ledger_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => nav("/app/ledgers", { state: { search: quickPanelFor.name_contact_info?.display_name } })}
                  >
                    Full history
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        wide
        title={form.id ? `Edit ${label}` : `New ${label}`}
        desc={`Identity & GST on the left, financial & communication on the right. A linked ledger is ${form.id ? "kept in sync" : "auto-created"}.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            {!form.id && (
              <Button variant="secondary" onClick={() => save(true)}>
                Save & New
              </Button>
            )}
            <Button onClick={() => save(false)}>{form.id ? "Save changes" : `Create ${label}`}</Button>
          </>
        }
      >
        <div className="grid lg:grid-cols-2 gap-x-8 gap-y-5">
          {/* Left: identity */}
          <div className="space-y-4">
            <div className="eyebrow">Identity</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Title">
                <Select value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}>
                  <option value="">—</option>
                  {titleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.text}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Party type">
                <Select value={form.key_group || kind} onChange={(e) => setForm({ ...form, key_group: e.target.value })}>
                  {partyTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.text}</option>
                  ))}
                </Select>
              </Field>
              <Field label="First name">
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} autoFocus />
              </Field>
              <Field label="Last name">
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </Field>
              <Field
                label="Company name"
                required
                className="col-span-2"
                error={submitted && !form.company_name.trim() ? "Company name is required" : undefined}
                hint={<ValidationHint level={nameHint?.level} message={nameHint?.message} />}
              >
                <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
              </Field>
              <Field label="GSTIN" hint={<ValidationHint level={gstinHint?.level as any} message={gstinHint?.message} />}>
                <Input className="mono uppercase" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="PAN" hint={<ValidationHint level={panHint?.level} message={panHint?.message} />}>
                <Input className="mono uppercase" maxLength={10} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="GST classification" className="col-span-2">
                <Select value={form.gst_type} onChange={(e) => setForm({ ...form, gst_type: e.target.value })}>
                  <option value="">Select</option>
                  {gstTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.text}</option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          {/* Right: financial & communication */}
          <div className="space-y-4">
            <div className="eyebrow">Financial & communication</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mobile">
                <Input value={form.mobile_number} onChange={(e) => setForm({ ...form, mobile_number: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Website" className="col-span-2">
                <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </Field>
              <Field label="Payment method">
                <Select value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="">Select payment method</option>
                  {(paymentMethodOptions.length ? paymentMethodOptions : [
                    { text: "Bank Transfer / NEFT / RTGS", value: "Bank Transfer / NEFT / RTGS" },
                    { text: "UPI / GPay / PhonePe", value: "UPI / GPay / PhonePe" },
                    { text: "Cheque", value: "Cheque" },
                    { text: "Cash", value: "Cash" },
                    { text: "Credit Card", value: "Credit Card" },
                  ]).map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.text}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Payment terms">
                <Select value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })}>
                  <option value="">Select payment terms</option>
                  {(paymentTermsOptions.length ? paymentTermsOptions : [
                    { text: "Due on receipt", value: "Due on receipt" },
                    { text: "Net 15", value: "Net 15" },
                    { text: "Net 30", value: "Net 30" },
                    { text: "Net 45", value: "Net 45" },
                    { text: "Net 60", value: "Net 60" },
                  ]).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.text}
                    </option>
                  ))}
                </Select>
              </Field>
              {(form.key_group || kind) !== "V" && (
                <Field label="Credit limit">
                  <Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
                </Field>
              )}
              <Field label="Opening balance">
                <Input type="number" value={form.opening_bal} onChange={(e) => setForm({ ...form, opening_bal: e.target.value })} />
              </Field>
              <Field label="As on date">
                <DatePicker value={form.date} onChange={(val) => setForm({ ...form, date: val })} />
              </Field>
            </div>
          </div>

          {/* Billing address */}
          <div className="space-y-4">
            <div className="eyebrow">Billing address</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Address line 1" className="col-span-2">
                <Input value={form.b_line1} onChange={(e) => setForm({ ...form, b_line1: e.target.value })} />
              </Field>
              <Field label="Address line 2" className="col-span-2">
                <Input value={form.b_line2} onChange={(e) => setForm({ ...form, b_line2: e.target.value })} />
              </Field>
              <Field label="City">
                <Input value={form.b_city} onChange={(e) => setForm({ ...form, b_city: e.target.value })} />
              </Field>
              <Field label="State">
                <Input value={form.b_state} onChange={(e) => setForm({ ...form, b_state: e.target.value })} />
              </Field>
              <Field label="PIN code">
                <Input value={form.b_pincode} onChange={(e) => setForm({ ...form, b_pincode: e.target.value })} />
              </Field>
              <Field label="Country">
                <Input value={form.b_country} onChange={(e) => setForm({ ...form, b_country: e.target.value })} />
              </Field>
            </div>
          </div>

          {/* Shipping address */}
          <div className="space-y-4">
            <div className="eyebrow flex items-center justify-between">
              <span>Shipping address</span>
              <label className="flex items-center gap-1.5 normal-case tracking-normal text-[12px] font-normal cursor-pointer">
                <Checkbox checked={form.same_as_billing} onChange={(e) => setForm({ ...form, same_as_billing: e.target.checked })} />
                Same as billing
              </label>
            </div>
            {!form.same_as_billing && (
              <div className="grid grid-cols-2 gap-3 fade-up">
                <Field label="Address line 1" className="col-span-2">
                  <Input value={form.s_line1} onChange={(e) => setForm({ ...form, s_line1: e.target.value })} />
                </Field>
                <Field label="City">
                  <Input value={form.s_city} onChange={(e) => setForm({ ...form, s_city: e.target.value })} />
                </Field>
                <Field label="State">
                  <Input value={form.s_state} onChange={(e) => setForm({ ...form, s_state: e.target.value })} />
                </Field>
                <Field label="PIN code">
                  <Input value={form.s_pincode} onChange={(e) => setForm({ ...form, s_pincode: e.target.value })} />
                </Field>
                <Field label="Country">
                  <Input value={form.s_country} onChange={(e) => setForm({ ...form, s_country: e.target.value })} />
                </Field>
              </div>
            )}
          </div>

          {/* Additional addresses (branch / warehouse / etc.) */}
          <div className="space-y-3 lg:col-span-2">
            <div className="eyebrow flex items-center justify-between">
              <span>Additional addresses</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    ...form,
                    extra_addresses: [
                      ...form.extra_addresses,
                      { label: "", address_line1: "", address_line2: "", city: "", state: "", country: "India", pincode: "" },
                    ],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add address
              </Button>
            </div>
            {form.extra_addresses.map((a, i) => (
              <div key={i} className="rounded-md border border-border p-3 grid grid-cols-2 gap-3 fade-up relative">
                <Field label="Label (e.g. Branch, Warehouse)" className="col-span-2">
                  <Input
                    value={a.label}
                    onChange={(e) => {
                      const list = [...form.extra_addresses];
                      list[i] = { ...a, label: e.target.value };
                      setForm({ ...form, extra_addresses: list });
                    }}
                  />
                </Field>
                <Field label="Address line 1" className="col-span-2">
                  <Input
                    value={a.address_line1}
                    onChange={(e) => {
                      const list = [...form.extra_addresses];
                      list[i] = { ...a, address_line1: e.target.value };
                      setForm({ ...form, extra_addresses: list });
                    }}
                  />
                </Field>
                <Field label="City">
                  <Input
                    value={a.city}
                    onChange={(e) => {
                      const list = [...form.extra_addresses];
                      list[i] = { ...a, city: e.target.value };
                      setForm({ ...form, extra_addresses: list });
                    }}
                  />
                </Field>
                <Field label="State">
                  <Input
                    value={a.state}
                    onChange={(e) => {
                      const list = [...form.extra_addresses];
                      list[i] = { ...a, state: e.target.value };
                      setForm({ ...form, extra_addresses: list });
                    }}
                  />
                </Field>
                <Field label="PIN code">
                  <Input
                    value={a.pincode}
                    onChange={(e) => {
                      const list = [...form.extra_addresses];
                      list[i] = { ...a, pincode: e.target.value };
                      setForm({ ...form, extra_addresses: list });
                    }}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setForm({ ...form, extra_addresses: form.extra_addresses.filter((_, idx) => idx !== i) })}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            {form.extra_addresses.length === 0 && (
              <p className="text-[12px] text-muted-foreground">No extra addresses. Billing & shipping are above.</p>
            )}
          </div>

          {/* Multiple contact persons */}
          <div className="space-y-3 lg:col-span-2">
            <div className="eyebrow flex items-center justify-between">
              <span>Contact persons</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm({
                    ...form,
                    contact_persons: [...form.contact_persons, { name: "", designation: "", email: "", mobile: "" }],
                  })
                }
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add contact
              </Button>
            </div>
            {form.contact_persons.map((c, i) => (
              <div key={i} className="rounded-md border border-border p-3 grid grid-cols-2 gap-3 fade-up">
                <Field label="Name">
                  <Input
                    value={c.name}
                    onChange={(e) => {
                      const list = [...form.contact_persons];
                      list[i] = { ...c, name: e.target.value };
                      setForm({ ...form, contact_persons: list });
                    }}
                  />
                </Field>
                <Field label="Designation">
                  <Input
                    value={c.designation}
                    onChange={(e) => {
                      const list = [...form.contact_persons];
                      list[i] = { ...c, designation: e.target.value };
                      setForm({ ...form, contact_persons: list });
                    }}
                  />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={c.email}
                    onChange={(e) => {
                      const list = [...form.contact_persons];
                      list[i] = { ...c, email: e.target.value };
                      setForm({ ...form, contact_persons: list });
                    }}
                  />
                </Field>
                <Field label="Mobile">
                  <div className="flex gap-2">
                    <Input
                      value={c.mobile}
                      onChange={(e) => {
                        const list = [...form.contact_persons];
                        list[i] = { ...c, mobile: e.target.value };
                        setForm({ ...form, contact_persons: list });
                      }}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => setForm({ ...form, contact_persons: form.contact_persons.filter((_, idx) => idx !== i) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </Field>
              </div>
            ))}
            {form.contact_persons.length === 0 && (
              <p className="text-[12px] text-muted-foreground">Add key people at this {label} (name, designation, email, mobile).</p>
            )}
          </div>
        </div>
      </Drawer>

      <ActivityDrawer
        open={!!auditFor}
        onClose={() => setAuditFor(null)}
        entity="party"
        entityId={auditFor?.id || null}
        title={auditFor?.name_contact_info?.display_name || ""}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity={kind === "C" ? "CUSTOMER" : "VENDOR"}
        entityLabel={kind === "C" ? "Customers" : "Vendors"}
        fields={[
          { key: "name", label: "Name", required: true },
          { key: "company", label: "Company" },
          { key: "gstin", label: "GSTIN" },
          { key: "pan", label: "PAN" },
          { key: "email", label: "Email" },
          { key: "mobile", label: "Mobile" },
          { key: "terms", label: "Terms" },
          { key: "credit_limit", label: "Credit limit" },
          { key: "opening_balance", label: "Opening balance" },
        ]}
        onImported={load}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Deactivate “${toDelete?.name_contact_info?.display_name}”?`}
        desc="The party stays visible in historical reports but is hidden from new vouchers."
        confirmLabel="Deactivate"
        onConfirm={confirmDelete}
      />
    </PageHeader>
  );
}
