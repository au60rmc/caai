import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Plus, Download, Upload, Sparkles, Settings, Trash2 } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { money } from "../lib/format";
import { downloadCSV } from "../lib/csv";
import { useHotkeys } from "../lib/hotkeys";
import { ActivityDrawer } from "../components/ActivityDrawer";
import { ImportDialog } from "../components/ImportDialog";
import {
  Button,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
  PageHeader,
  Panel,
  SearchBox,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  Money,
  Badge,
  Modal,
  RowActions,
  Drawer,
  ConfirmDialog,
  Spinner,
  ValidationHint,
} from "../components/ui";

interface Item {
  id: number;
  item_code: string;
  item_name: string;
  item_type?: string;
  hsn_sac?: string;
  unit?: string;
  description?: string;
  purchase_rate?: number;
  sale_rate?: number;
  gst_percent?: number;
  tax_category?: string;
  track_inventory?: string;
  opening_stock?: number;
  min_stock_level?: number;
  max_stock_level?: number;
  warehouse?: string;
  custom_fields?: Record<string, any> | null;
  status: string;
}
interface PriceHistoryEntry {
  date: string;
  purchase_rate: number;
  sale_rate: number;
}
interface UnitRow {
  id: string;
  unit_name: string;
  unit_symbol: string;
}

const empty = (): Partial<Item> => ({
  item_code: "",
  item_name: "",
  item_type: "G",
  hsn_sac: "",
  unit: "PCS",
  description: "",
  purchase_rate: 0,
  sale_rate: 0,
  gst_percent: 18,
  track_inventory: "N",
  opening_stock: 0,
  min_stock_level: 0,
  max_stock_level: 0,
  warehouse: "",
  status: "Active",
});

export function Products() {
  const { can } = useAuth();
  const { toast } = useToast();
  const loc = useLocation();
  const nav = useNavigate();
  const canWrite = can("ITEMS", "write");
  const canDelete = can("ITEMS", "delete");

  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [gstRates, setGstRates] = useState<{ rate: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState((loc.state as any)?.search || "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<Partial<Item>>(empty());
  const [submitted, setSubmitted] = useState(false);
  const [toDelete, setToDelete] = useState<Item | null>(null);
  const [auditFor, setAuditFor] = useState<Item | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkGstOpen, setBulkGstOpen] = useState(false);
  const [bulkGst, setBulkGst] = useState("18");
  const [codeHint, setCodeHint] = useState<any | null>(null);
  const [nameHint, setNameHint] = useState<any | null>(null);
  const [hsnSuggestions, setHsnSuggestions] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    const [ir, ur, rr] = await Promise.all([
      api.get("/items"),
      api.get("/units"),
      api.get("/gst/rates"),
    ]);
    setItems(ir.ok && Array.isArray(ir.data) ? ir.data : []);
    setUnits(envelopeResult<UnitRow[]>(ur) || []);
    setGstRates(envelopeResult<{ rate: number }[]>(rr) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

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

  // Live duplicate detection.
  useEffect(() => {
    if (!drawer) return;
    const t = setTimeout(async () => {
      if (!form.item_code && !form.item_name) return;
      const r = await api.post("/items/validate", {
        id: form.id || null,
        item_code: form.item_code || null,
        item_name: form.item_name || null,
      });
      const res = r.data?.result;
      setCodeHint(res?.item_code || null);
      setNameHint(res?.item_name || null);
    }, 350);
    return () => clearTimeout(t);
  }, [form.item_code, form.item_name, form.id, drawer]);

  // HSN/SAC suggestion based on description (spec 7.1).
  useEffect(() => {
    if (!drawer || !form.description || form.description.length < 6) {
      setHsnSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api.get(`/gst/hsn/suggest?description=${encodeURIComponent(form.description || "")}`);
      setHsnSuggestions(envelopeResult<any[]>(r) || []);
    }, 450);
    return () => clearTimeout(t);
  }, [form.description, drawer]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (statusFilter === "ALL" || i.status === statusFilter) &&
          (typeFilter === "ALL" || i.item_type === typeFilter) &&
          `${i.item_code} ${i.item_name} ${i.hsn_sac || ""}`.toLowerCase().includes(q.toLowerCase())
      ),
    [items, q, statusFilter, typeFilter]
  );

  function openNew() {
    setForm(empty());
    setSubmitted(false);
    setCodeHint(null);
    setNameHint(null);
    setDrawer(true);
  }
  function openEdit(i: Item) {
    setForm({ ...i });
    setSubmitted(false);
    setCodeHint(null);
    setNameHint(null);
    setDrawer(true);
  }

  async function save(andNew: boolean) {
    setSubmitted(true);
    if (!form.item_code?.trim() || !form.item_name?.trim()) return;
    const newP = Number(form.purchase_rate) || 0;
    const newS = Number(form.sale_rate) || 0;
    // Maintain a price history log inside custom_fields (spec 7 "price history").
    const prevHist: PriceHistoryEntry[] = (form.custom_fields?.price_history as PriceHistoryEntry[]) || [];
    const last = prevHist[prevHist.length - 1];
    const history =
      !last || last.purchase_rate !== newP || last.sale_rate !== newS
        ? [...prevHist, { date: new Date().toISOString().slice(0, 10), purchase_rate: newP, sale_rate: newS }].slice(-20)
        : prevHist;
    const payload = {
      item_code: form.item_code,
      item_name: form.item_name,
      item_type: form.item_type || "G",
      hsn_sac: form.hsn_sac || null,
      unit: form.unit || "PCS",
      description: form.description || null,
      purchase_rate: newP,
      sale_rate: newS,
      gst_percent: Number(form.gst_percent) || 0,
      tax_category: form.tax_category || null,
      track_inventory: form.track_inventory || "N",
      opening_stock: Number(form.opening_stock) || 0,
      min_stock_level: Number(form.min_stock_level) || 0,
      max_stock_level: Number(form.max_stock_level) || 0,
      warehouse: form.warehouse || null,
      custom_fields: { ...(form.custom_fields || {}), price_history: history },
      status: form.status || "Active",
    };
    const r = form.id ? await api.put(`/items/${form.id}`, payload) : await api.post("/items", payload);
    if (!r.ok) {
      toast({ title: "Could not save", desc: r.data?.detail || "Please check the form", tone: "error" });
      return;
    }
    toast({ title: form.id ? "Item updated" : "Item created", desc: form.item_name, tone: "success" });
    if (andNew) {
      setForm(empty());
      setSubmitted(false);
    } else setDrawer(false);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const r = await api.del(`/items/${toDelete.id}`);
    if (!r.ok) {
      toast({ title: "Could not delete", desc: r.data?.detail || "", tone: "error" });
      return;
    }
    toast({ title: "Item deactivated", tone: "success" });
    load();
  }

  function exportCSV() {
    downloadCSV(
      "items.csv",
      ["item_code", "item_name", "item_type", "hsn_sac", "unit", "purchase_rate", "sale_rate", "gst_percent", "opening_stock", "status"],
      filtered.map((i) => [
        i.item_code, i.item_name, i.item_type === "S" ? "Service" : "Goods",
        i.hsn_sac || "", i.unit || "", i.purchase_rate || 0, i.sale_rate || 0,
        i.gst_percent || 0, i.opening_stock || 0, i.status,
      ])
    );
  }

  function toggleSelect(id: number, checked: boolean) {
    setSelected((s) => {
      const n = new Set(s);
      checked ? n.add(id) : n.delete(id);
      return n;
    });
  }

  async function bulkStatus(active: "Y" | "N") {
    const r = await api.post("/import/bulk-status", { entity: "ITEM", ids: [...selected].map(String), active });
    toast({ title: envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    setSelected(new Set());
    load();
  }

  async function applyBulkGst() {
    const r = await api.post("/import/bulk-gst", { ids: [...selected].map(String), gst_percent: Number(bulkGst) });
    toast({ title: envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    setBulkGstOpen(false);
    setSelected(new Set());
    load();
  }

  async function bulkDelete() {
    if (!confirm(`Deactivate ${selected.size} selected item(s)? Items used in vouchers keep their history.`)) return;
    const r = await api.post("/import/bulk-delete", { entity: "ITEM", ids: [...selected].map(String) });
    toast({ title: envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    setSelected(new Set());
    load();
  }

  const stockValue = items.reduce((s, i) => s + (i.opening_stock || 0) * (i.purchase_rate || 0), 0);
  const trackInv = form.track_inventory === "Y" && form.item_type !== "S";

  return (
    <PageHeader
      title="Product / Item Master"
      sub="Goods and services for sales, purchases and GST — inventory is optional per item"
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
              New item
            </Button>
          )}
          <Button size="sm" variant="ghost" title="Master settings (custom fields)" onClick={() => nav("/app/custom-fields")}>
            <Settings className="h-4 w-4" />
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { l: "Total SKUs", v: String(items.length) },
          { l: "Services", v: String(items.filter((i) => i.item_type === "S").length) },
          { l: "GST missing", v: String(items.filter((i) => !i.gst_percent).length) },
          { l: "Stock value (cost)", v: null as any },
        ].map((c) => (
          <div key={c.l} className="card-panel px-5 py-3.5">
            <div className="text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">{c.l}</div>
            <div className="fig text-[22px] mt-0.5">{c.v ?? <Money v={stockValue} />}</div>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="card-panel mb-4 px-4 py-2.5 flex items-center gap-3 fade-up">
          <span className="text-[13px] font-semibold">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => bulkStatus("Y")}>Activate</Button>
          <Button size="sm" variant="outline" onClick={() => bulkStatus("N")}>Deactivate</Button>
          <Button size="sm" variant="outline" onClick={() => setBulkGstOpen(true)}>Bulk GST rate…</Button>
          {canDelete && (
            <Button size="sm" variant="outline" className="text-destructive border-destructive/40 hover:text-destructive" onClick={bulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <Panel
        pad={false}
        title={`${filtered.length} items`}
        right={
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 w-28 bg-card">
              <option value="ALL">All types</option>
              <option value="G">Goods</option>
              <option value="S">Services</option>
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-32 bg-card">
              <option value="ALL">All statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </Select>
            <SearchBox value={q} onChange={setQ} placeholder="Search code, name, HSN" />
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
                <Th>Code</Th>
                <Th>Name</Th>
                <Th className="w-20">Type</Th>
                <Th>HSN/SAC</Th>
                <Th right>Purchase</Th>
                <Th right>Sale</Th>
                <Th right>GST</Th>
                <Th right>Stock</Th>
                <Th className="w-24">Status</Th>
                <Th className="w-40" right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={11} text="No products match." />}
              {filtered.map((i) => (
                <tr key={i.id} className="hover:bg-muted/40">
                  <Td>
                    <Checkbox checked={selected.has(i.id)} onChange={(e) => toggleSelect(i.id, e.target.checked)} />
                  </Td>
                  <Td className="mono">{i.item_code}</Td>
                  <Td className="font-medium">{i.item_name}</Td>
                  <Td>
                    <Badge tone={i.item_type === "S" ? "warn" : "ok"}>{i.item_type === "S" ? "Service" : "Goods"}</Badge>
                  </Td>
                  <Td className="mono text-muted-foreground">{i.hsn_sac || "—"}</Td>
                  <Td right><Money v={i.purchase_rate || 0} /></Td>
                  <Td right><Money v={i.sale_rate || 0} /></Td>
                  <Td right className="fig">{i.gst_percent ? `${i.gst_percent}%` : <span className="hint-warning">—</span>}</Td>
                  <Td right>
                    {i.track_inventory === "Y" ? (
                      <span className={"fig " + ((i.opening_stock || 0) <= (i.min_stock_level || 0) ? "text-[var(--red)]" : "")}>
                        {i.opening_stock}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">n/a</span>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={i.status === "Active" ? "ok" : "muted"}>{i.status}</Badge>
                  </Td>
                  <Td>
                    <RowActions
                      canEdit={canWrite}
                      canDelete={canDelete}
                      onActivity={() => setAuditFor(i)}
                      onEdit={() => openEdit(i)}
                      onDelete={() => setToDelete(i)}
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
        title={form.id ? "Edit item" : "New item"}
        desc="Inventory fields appear only when stock tracking is on."
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            {!form.id && (
              <Button variant="secondary" onClick={() => save(true)}>Save & New</Button>
            )}
            <Button onClick={() => save(false)}>{form.id ? "Save changes" : "Create item"}</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="eyebrow">Item basics</div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Item code"
              required
              error={submitted && !form.item_code?.trim() ? "Required" : undefined}
              hint={<ValidationHint level={codeHint?.level} message={codeHint?.message} />}
            >
              <Input className="mono" value={form.item_code || ""} onChange={(e) => setForm({ ...form, item_code: e.target.value })} />
            </Field>
            <Field label="Goods / Service">
              <Select
                value={form.item_type || "G"}
                onChange={(e) => setForm({ ...form, item_type: e.target.value, track_inventory: e.target.value === "S" ? "N" : form.track_inventory })}
              >
                <option value="G">Goods</option>
                <option value="S">Service</option>
              </Select>
            </Field>
            <Field
              label="Item name"
              required
              className="col-span-2"
              error={submitted && !form.item_name?.trim() ? "Required" : undefined}
              hint={<ValidationHint level={nameHint?.level} message={nameHint?.message} />}
            >
              <Input value={form.item_name || ""} onChange={(e) => setForm({ ...form, item_name: e.target.value })} />
            </Field>
            <Field label="Description" className="col-span-2">
              <Textarea rows={2} value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              {hsnSuggestions.length > 0 && !form.hsn_sac && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {hsnSuggestions.map((s) => (
                    <button
                      key={s.code}
                      className="inline-flex items-center gap-1 text-[11.5px] rounded-full px-2.5 py-1 bg-[var(--teal-soft)] text-[var(--teal)] font-medium hover:opacity-80"
                      onClick={() => setForm({ ...form, hsn_sac: s.code, gst_percent: s.gst_rate ?? form.gst_percent })}
                      title={s.description}
                    >
                      <Sparkles className="h-3 w-3" />
                      {s.kind === "S" ? "SAC" : "HSN"} {s.code} · {s.gst_rate}%
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>

          <div className="eyebrow">Pricing & GST</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase rate">
              <Input type="number" value={form.purchase_rate ?? 0} onChange={(e) => setForm({ ...form, purchase_rate: +e.target.value })} />
            </Field>
            <Field label="Sale rate">
              <Input type="number" value={form.sale_rate ?? 0} onChange={(e) => setForm({ ...form, sale_rate: +e.target.value })} />
            </Field>
            <Field label="HSN / SAC">
              <Input className="mono" value={form.hsn_sac || ""} onChange={(e) => setForm({ ...form, hsn_sac: e.target.value })} />
            </Field>
            <Field label="GST rate">
              <Select value={String(form.gst_percent ?? "")} onChange={(e) => setForm({ ...form, gst_percent: +e.target.value })}>
                <option value="">Select</option>
                {gstRates.map((g) => (
                  <option key={g.rate} value={g.rate}>{g.rate}%</option>
                ))}
              </Select>
            </Field>
            <Field label="Unit">
              <Select value={form.unit || "PCS"} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {units.length === 0 && <option value="PCS">PCS</option>}
                {units.map((u) => (
                  <option key={u.id} value={u.unit_symbol}>{u.unit_name} ({u.unit_symbol})</option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </Field>
          </div>

          {Array.isArray(form.custom_fields?.price_history) && form.custom_fields!.price_history.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="px-3 py-2 bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Price history
              </div>
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="text-left px-3 py-1.5 font-medium">Date</th>
                    <th className="text-right px-3 py-1.5 font-medium">Purchase</th>
                    <th className="text-right px-3 py-1.5 font-medium">Sale</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(form.custom_fields!.price_history as PriceHistoryEntry[])]
                    .slice()
                    .reverse()
                    .map((h, idx) => (
                      <tr key={idx} className="border-t border-border/60">
                        <td className="px-3 py-1.5">{h.date}</td>
                        <td className="px-3 py-1.5 text-right fig">{money(h.purchase_rate)}</td>
                        <td className="px-3 py-1.5 text-right fig">{money(h.sale_rate)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {form.item_type !== "S" && (
            <>
              <div className="eyebrow flex items-center justify-between">
                <span>Inventory (optional)</span>
                <label className="flex items-center gap-1.5 normal-case tracking-normal text-[12px] font-normal cursor-pointer">
                  <Checkbox
                    checked={form.track_inventory === "Y"}
                    onChange={(e) => setForm({ ...form, track_inventory: e.target.checked ? "Y" : "N" })}
                  />
                  Track stock for this item
                </label>
              </div>
              {trackInv && (
                <div className="grid grid-cols-2 gap-3 fade-up">
                  <Field label="Opening stock">
                    <Input type="number" value={form.opening_stock ?? 0} onChange={(e) => setForm({ ...form, opening_stock: +e.target.value })} />
                  </Field>
                  <Field label="Reorder level">
                    <Input type="number" value={form.min_stock_level ?? 0} onChange={(e) => setForm({ ...form, min_stock_level: +e.target.value })} />
                  </Field>
                  <Field label="Max stock level">
                    <Input type="number" value={form.max_stock_level ?? 0} onChange={(e) => setForm({ ...form, max_stock_level: +e.target.value })} />
                  </Field>
                  <Field label="Warehouse / location">
                    <Input value={form.warehouse || ""} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
                  </Field>
                </div>
              )}
            </>
          )}
        </div>
      </Drawer>

      <ActivityDrawer
        open={!!auditFor}
        onClose={() => setAuditFor(null)}
        entity="product_item"
        entityId={auditFor ? String(auditFor.id) : null}
        title={auditFor?.item_name || ""}
      />

      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        entity="ITEM"
        entityLabel="Items"
        fields={[
          { key: "item_name", label: "Name", required: true },
          { key: "item_code", label: "Code" },
          { key: "item_type", label: "Type (G/S)" },
          { key: "hsn_sac", label: "HSN/SAC" },
          { key: "unit", label: "Unit" },
          { key: "purchase_rate", label: "Purchase rate" },
          { key: "sale_rate", label: "Sale rate" },
          { key: "gst_percent", label: "GST %" },
          { key: "opening_stock", label: "Opening stock" },
        ]}
        onImported={load}
      />

      <Modal
        open={bulkGstOpen}
        onClose={() => setBulkGstOpen(false)}
        title="Bulk GST rate update"
        desc={`Apply a GST rate to ${selected.size} selected items.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setBulkGstOpen(false)}>Cancel</Button>
            <Button onClick={applyBulkGst}>Apply</Button>
          </>
        }
      >
        <Field label="GST rate">
          <Select value={bulkGst} onChange={(e) => setBulkGst(e.target.value)}>
            {gstRates.map((g) => (
              <option key={g.rate} value={g.rate}>{g.rate}%</option>
            ))}
          </Select>
        </Field>
      </Modal>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Deactivate “${toDelete?.item_name}”?`} desc="Items used in vouchers are never hard-deleted." confirmLabel="Deactivate" onConfirm={confirmDelete} />
    </PageHeader>
  );
}
