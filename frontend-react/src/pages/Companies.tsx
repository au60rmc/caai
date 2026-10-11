import { useEffect, useState } from "react";
import { Plus, Building2 } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { useToast } from "../components/toast";
import { quickGstinHint, quickPanHint } from "../lib/gst";
import { ActivityDrawer } from "../components/ActivityDrawer";
import {
  Button, DatePicker, Field, Input, Select, Textarea, PageHeader, Panel, TableWrap, Th, Td,
  EmptyRow, Badge, RowActions, Drawer, ConfirmDialog, Spinner, ValidationHint,
} from "../components/ui";

interface Company {
  id: string;
  company_name: string;
  gstin: string | null;
  pan: string | null;
  state_code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  email: string | null;
  mobile: string | null;
  financial_year_start: string | null;
  financial_year_end: string | null;
  currency: string | null;
  maintain_mode: "ACCOUNT_ONLY" | "ACCOUNT_WITH_INVENTORY";
  is_default: string;
  active: string;
}
interface StateRow { code: string; name: string; }

const empty = () => ({
  id: null as string | null,
  company_name: "",
  gstin: "",
  pan: "",
  state_code: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  email: "",
  mobile: "",
  financial_year_start: "",
  financial_year_end: "",
  currency: "INR",
  maintain_mode: "" as "" | "ACCOUNT_ONLY" | "ACCOUNT_WITH_INVENTORY",
  is_default: "N",
});

export function Companies() {
  const { can } = useAuth();
  const { switchCompany, refreshCompanies, companyId } = useCompany();
  const { toast } = useToast();
  const canWrite = can("COMPANY", "write");
  const canDelete = can("COMPANY", "delete");

  const [rows, setRows] = useState<Company[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState(empty());
  const [submitted, setSubmitted] = useState(false);
  const [toDelete, setToDelete] = useState<Company | null>(null);
  const [auditFor, setAuditFor] = useState<Company | null>(null);

  const gstinHint = quickGstinHint(form.gstin);
  const panHint = quickPanHint(form.pan);

  async function load() {
    setLoading(true);
    const [cr, sr] = await Promise.all([api.get("/companies?include_all=true"), api.get("/gst/states")]);
    setRows(envelopeResult<Company[]>(cr) || []);
    setStates(envelopeResult<StateRow[]>(sr) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm(empty());
    setSubmitted(false);
    setDrawer(true);
  }
  function openEdit(c: Company) {
    setForm({
      id: c.id,
      company_name: c.company_name || "",
      gstin: c.gstin || "",
      pan: c.pan || "",
      state_code: c.state_code || "",
      address: c.address || "",
      city: c.city || "",
      state: c.state || "",
      pincode: c.pincode || "",
      email: c.email || "",
      mobile: c.mobile || "",
      financial_year_start: c.financial_year_start || "",
      financial_year_end: c.financial_year_end || "",
      currency: c.currency || "INR",
      maintain_mode: c.maintain_mode || "ACCOUNT_ONLY",
      is_default: c.is_default || "N",
    });
    setSubmitted(false);
    setDrawer(true);
  }

  async function save() {
    setSubmitted(true);
    if (!form.company_name.trim() || !form.maintain_mode) return;
    const payload = {
      company_name: form.company_name.trim(),
      gstin: form.gstin ? form.gstin.toUpperCase() : null,
      pan: form.pan ? form.pan.toUpperCase() : null,
      state_code: form.state_code || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      pincode: form.pincode || null,
      email: form.email || null,
      mobile: form.mobile || null,
      financial_year_start: form.financial_year_start || null,
      financial_year_end: form.financial_year_end || null,
      currency: form.currency || "INR",
      maintain_mode: form.maintain_mode,
      is_default: form.is_default,
      active: "Y",
    };
    const r = form.id ? await api.put(`/companies/${form.id}`, payload) : await api.post("/companies", payload);
    if (!envelopeOk(r)) {
      toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: form.id ? "Company updated" : "Company created", desc: form.company_name, tone: "success" });
    setDrawer(false);
    const created = envelopeResult<Company>(r);
    if (!form.id && created?.id) {
      switchCompany(created.id);
    }
    await refreshCompanies();
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const r = await api.del(`/companies/${toDelete.id}`);
    if (!envelopeOk(r)) {
      toast({ title: "Could not remove", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: "Company removed", tone: "success" });
    if (toDelete.id === companyId || toDelete.id === localStorage.getItem("active_company_id")) {
      localStorage.removeItem("active_company_id");
    }
    await refreshCompanies();
    load();
  }

  return (
    <PageHeader
      title="Company Master"
      sub="Business profile, GST, PAN and financial year — the root context for multi-company accounting"
      actions={
        canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            New company
          </Button>
        )
      }
    >
      <Panel pad={false} title={`${rows.length} companies`}>
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Company</Th>
                <Th>GSTIN</Th>
                <Th>PAN</Th>
                <Th>State</Th>
                <Th>Financial year</Th>
                <Th className="w-20">Default</Th>
                <Th className="w-44" right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <EmptyRow colSpan={7} />}
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-md grid place-items-center shrink-0" style={{ background: "var(--teal-soft)", color: "var(--teal)" }}>
                        <Building2 className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-medium">{c.company_name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{[c.city, c.state].filter(Boolean).join(", ")}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="mono">{c.gstin || <Badge tone="warn">Missing</Badge>}</Td>
                  <Td className="mono">{c.pan || "—"}</Td>
                  <Td className="text-muted-foreground">{c.state || c.state_code || "—"}</Td>
                  <Td className="text-muted-foreground">
                    {c.financial_year_start && c.financial_year_end
                      ? `${c.financial_year_start} → ${c.financial_year_end}`
                      : "—"}
                  </Td>
                  <Td>{c.is_default === "Y" ? <Badge tone="ok">Default</Badge> : "—"}</Td>
                  <Td>
                    <RowActions
                      canEdit={canWrite}
                      canDelete={canDelete && c.is_default !== "Y"}
                      onActivity={() => setAuditFor(c)}
                      onEdit={() => openEdit(c)}
                      onDelete={() => setToDelete(c)}
                    />
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
        title={form.id ? "Edit company" : "New company"}
        desc="The state code auto-fills from a valid GSTIN and drives CGST/SGST vs IGST classification."
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>Cancel</Button>
            <Button onClick={save}>{form.id ? "Save changes" : "Create company"}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="eyebrow">Business profile</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Company name" required className="md:col-span-2" error={submitted && !form.company_name.trim() ? "Required" : undefined}>
              <Input autoFocus value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </Field>
            <Field label="Maintain" required className="md:col-span-2" error={submitted && !form.maintain_mode ? "Select one option" : undefined}>
              <div className="flex flex-col gap-3 sm:flex-row sm:gap-6" role="radiogroup" aria-label="Maintain">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="maintain_mode"
                    value="ACCOUNT_ONLY"
                    checked={form.maintain_mode === "ACCOUNT_ONLY"}
                    onChange={() => setForm({ ...form, maintain_mode: "ACCOUNT_ONLY" })}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                  Account only
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="maintain_mode"
                    value="ACCOUNT_WITH_INVENTORY"
                    checked={form.maintain_mode === "ACCOUNT_WITH_INVENTORY"}
                    onChange={() => setForm({ ...form, maintain_mode: "ACCOUNT_WITH_INVENTORY" })}
                    className="h-4 w-4 accent-[var(--teal)]"
                  />
                  Account with inventory
                </label>
              </div>
            </Field>
            <Field label="GSTIN" hint={<ValidationHint level={gstinHint?.level} message={gstinHint?.message} />}>
              <Input className="mono uppercase" maxLength={15} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="PAN" hint={<ValidationHint level={panHint?.level} message={panHint?.message} />}>
              <Input className="mono uppercase" maxLength={10} value={form.pan} onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="GST state">
              <Select value={form.state_code} onChange={(e) => setForm({ ...form, state_code: e.target.value })}>
                <option value="">Select</option>
                {states.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Currency">
              <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            </Field>
          </div>

          <div className="eyebrow">Registered address & contact</div>
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Address" className="md:col-span-2">
              <Textarea rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field label="City">
              <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="State">
              <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </Field>
            <Field label="PIN code">
              <Input value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Email" className="md:col-span-2">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>

          <div className="eyebrow">Financial year</div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="FY start">
              <DatePicker value={form.financial_year_start} onChange={(val) => setForm({ ...form, financial_year_start: val })} />
            </Field>
            <Field label="FY end">
              <DatePicker value={form.financial_year_end} onChange={(val) => setForm({ ...form, financial_year_end: val })} />
            </Field>
            <Field label="Default company">
              <Select value={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.value })}>
                <option value="N">No</option>
                <option value="Y">Yes</option>
              </Select>
            </Field>
          </div>
        </div>
      </Drawer>

      <ActivityDrawer
        open={!!auditFor}
        onClose={() => setAuditFor(null)}
        entity="company"
        entityId={auditFor?.id || null}
        title={auditFor?.company_name || ""}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Remove “${toDelete?.company_name}”?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </PageHeader>
  );
}
