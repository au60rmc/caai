import { useEffect, useMemo, useState } from "react";
import { Plus, Power } from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { ActivityDrawer } from "../components/ActivityDrawer";
import { useToast } from "../components/toast";
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  Drawer,
  EmptyRow,
  Field,
  Input,
  PageHeader,
  Panel,
  SearchBox,
  Select,
  Spinner,
  TableWrap,
  Td,
  Th,
} from "../components/ui";
import { api, envelopeMessage, envelopeOk, envelopeResult } from "../lib/api";
import { useHotkeys } from "../lib/hotkeys";
import { invalidateVoucherRefsCache } from "../lib/vouchers";

interface VoucherType {
  id: string;
  company_id: string;
  name: string;
  base_voucher_type: string;
  abbreviation: string | null;
  active: "Y" | "N";
  is_system: "Y" | "N";
}

interface BaseVoucherType {
  id: string;
  name: string;
  code: string;
}

function emptyForm() {
  return {
    id: null as string | null,
    name: "",
    base_voucher_type: "",
    abbreviation: "",
    active: "Y" as "Y" | "N",
    is_system: "N" as "Y" | "N",
  };
}

export function VoucherTypes() {
  const { can } = useAuth();
  const { companyId } = useCompany();
  const { toast } = useToast();
  const canWrite = can("VOUCHER_TYPE", "write");
  const canDeactivate = can("VOUCHER_TYPE", "delete");

  const [rows, setRows] = useState<VoucherType[]>([]);
  const [baseOptions, setBaseOptions] = useState<BaseVoucherType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [baseFilter, setBaseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [drawer, setDrawer] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [toDeactivate, setToDeactivate] = useState<VoucherType | null>(null);
  const [auditFor, setAuditFor] = useState<VoucherType | null>(null);

  async function load() {
    setLoading(true);
    const [typesResponse, basesResponse] = await Promise.all([
      api.get("/voucher-types?include_inactive=true"),
      api.get("/voucher-types/base-options"),
    ]);
    if (!envelopeOk(typesResponse)) {
      toast({ title: "Could not load Voucher Types", desc: envelopeMessage(typesResponse), tone: "error" });
    }
    setRows(envelopeResult<VoucherType[]>(typesResponse) || []);
    setBaseOptions(envelopeResult<BaseVoucherType[]>(basesResponse) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  useHotkeys(
    useMemo(
      () => ({
        "ctrl+n": () => canWrite && openNew(),
        "ctrl+s": () => drawer && canWrite && save(),
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [canWrite, drawer, form, rows]
    )
  );

  const baseNames = useMemo(
    () => new Map(baseOptions.map((option) => [option.code, option.name])),
    [baseOptions]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesBase = baseFilter === "ALL" || row.base_voucher_type === baseFilter;
      const matchesStatus = statusFilter === "ALL" || row.active === statusFilter;
      if (!matchesBase || !matchesStatus) return false;
      if (!q) return true;
      const text = `${row.name} ${row.abbreviation || ""} ${baseNames.get(row.base_voucher_type) || row.base_voucher_type}`.toLowerCase();
      return text.includes(q);
    });
  }, [rows, query, baseFilter, statusFilter, baseNames]);

  function openNew() {
    const next = emptyForm();
    next.base_voucher_type = baseOptions[0]?.code || "";
    setForm(next);
    setSubmitted(false);
    setDrawer(true);
  }

  function openEdit(row: VoucherType) {
    setForm({
      id: row.id,
      name: row.name,
      base_voucher_type: row.base_voucher_type,
      abbreviation: row.abbreviation || "",
      active: row.active,
      is_system: row.is_system,
    });
    setSubmitted(false);
    setDrawer(true);
  }

  async function save() {
    setSubmitted(true);
    const cleanName = form.name.trim();
    if (!cleanName || !form.base_voucher_type) return;
    const duplicate = rows.some(
      (row) => row.id !== form.id && row.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (duplicate) {
      toast({ title: "Voucher Type name already exists", tone: "error" });
      return;
    }

    setSaving(true);
    const payload = {
      name: cleanName,
      base_voucher_type: form.base_voucher_type,
      abbreviation: form.abbreviation.trim().toUpperCase() || null,
    };
    const response = form.id
      ? await api.put(`/voucher-types/${form.id}`, payload)
      : await api.post("/voucher-types", { ...payload, active: form.active });
    setSaving(false);
    if (!envelopeOk(response)) {
      toast({ title: "Could not save Voucher Type", desc: envelopeMessage(response), tone: "error" });
      return;
    }
    toast({
      title: form.id ? "Voucher Type updated" : "Voucher Type created",
      desc: cleanName,
      tone: "success",
    });
    invalidateVoucherRefsCache();
    setDrawer(false);
    load();
  }

  async function setActive(row: VoucherType, active: "Y" | "N") {
    const action = active === "Y" ? "activate" : "deactivate";
    const response = await api.patch(`/voucher-types/${row.id}/${action}`, {});
    if (!envelopeOk(response)) {
      toast({ title: `Could not ${action} Voucher Type`, desc: envelopeMessage(response), tone: "error" });
      return;
    }
    toast({ title: `Voucher Type ${active === "Y" ? "activated" : "deactivated"}`, desc: row.name, tone: "success" });
    invalidateVoucherRefsCache();
    load();
  }

  return (
    <PageHeader
      title="Voucher Types"
      sub="Business-specific voucher definitions based on standard accounting categories"
      actions={
        canWrite && (
          <Button size="sm" onClick={openNew} title="Ctrl+N">
            <Plus className="h-4 w-4" />
            Create Voucher Type
          </Button>
        )
      }
    >
      <Panel
        pad={false}
        title={`${filtered.length} voucher types`}
        right={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <Select className="h-9 w-full bg-card sm:w-40" value={baseFilter} onChange={(event) => setBaseFilter(event.target.value)}>
              <option value="ALL">All base types</option>
              {baseOptions.map((option) => (
                <option key={option.id} value={option.code}>{option.name}</option>
              ))}
            </Select>
            <Select className="h-9 w-full bg-card sm:w-32" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="Y">Active</option>
              <option value="N">Inactive</option>
            </Select>
            <SearchBox value={query} onChange={setQuery} placeholder="Search voucher types" />
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
                <Th>Voucher Type</Th>
                <Th>Base Voucher Type</Th>
                <Th className="w-36">Abbreviation</Th>
                <Th className="w-28">Status</Th>
                <Th className="w-60" right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={6} text="No Voucher Types found." />}
              {filtered.map((row, index) => (
                <tr key={row.id} className="hover:bg-muted/40">
                  <Td className="mono text-muted-foreground">{index + 1}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      {row.is_system === "Y" && <Badge tone="muted">System</Badge>}
                    </div>
                  </Td>
                  <Td>{baseNames.get(row.base_voucher_type) || row.base_voucher_type}</Td>
                  <Td className="mono text-muted-foreground">{row.abbreviation || "-"}</Td>
                  <Td><Badge tone={row.active === "Y" ? "ok" : "bad"}>{row.active === "Y" ? "Active" : "Inactive"}</Badge></Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setAuditFor(row)}>Activity</Button>
                      {canWrite && <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEdit(row)}>Edit</Button>}
                      {row.active === "Y" && canDeactivate && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive" onClick={() => setToDeactivate(row)}>
                          Deactivate
                        </Button>
                      )}
                      {row.active === "N" && canWrite && (
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setActive(row, "Y")}>
                          <Power className="h-3.5 w-3.5" />
                          Activate
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
        title={form.id ? "Edit Voucher Type" : "Create Voucher Type"}
        desc={form.id && form.is_system === "Y" ? "System-defined base Voucher Type" : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{form.id ? "Save changes" : "Create"}</Button>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="Name" required error={submitted && !form.name.trim() ? "Name is required" : undefined}>
            <Input autoFocus maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </Field>
          <Field
            label="Base Voucher Type"
            required
            error={submitted && !form.base_voucher_type ? "Base Voucher Type is required" : undefined}
            hint={form.id && form.is_system === "Y" ? <p className="text-[11px] text-muted-foreground">Base category cannot be changed for system records</p> : undefined}
          >
            <Select
              disabled={!!form.id && form.is_system === "Y"}
              value={form.base_voucher_type}
              onChange={(event) => setForm({ ...form, base_voucher_type: event.target.value })}
            >
              <option value="">Select base type</option>
              {baseOptions.map((option) => (
                <option key={option.id} value={option.code}>{option.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Abbreviation">
            <Input className="mono uppercase" maxLength={20} value={form.abbreviation} onChange={(event) => setForm({ ...form, abbreviation: event.target.value.toUpperCase() })} />
          </Field>
          {!form.id && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={form.active === "Y"} onChange={(event) => setForm({ ...form, active: event.target.checked ? "Y" : "N" })} />
              Active
            </label>
          )}
        </div>
      </Drawer>

      <ActivityDrawer
        open={!!auditFor}
        onClose={() => setAuditFor(null)}
        entity="voucher_type"
        entityId={auditFor?.id || null}
        title={auditFor?.name || ""}
      />

      <ConfirmDialog
        open={!!toDeactivate}
        onClose={() => setToDeactivate(null)}
        title={`Deactivate ${toDeactivate?.name}?`}
        desc="It will no longer be available for new vouchers. Existing transactions keep their original Voucher Type."
        confirmLabel="Deactivate"
        onConfirm={() => toDeactivate && setActive(toDeactivate, "N")}
      />
    </PageHeader>
  );
}