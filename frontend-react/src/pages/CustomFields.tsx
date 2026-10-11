import { useEffect, useState } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { Button, Input, Select, PageHeader, Panel, TableWrap, Th, Td, EmptyRow, Spinner, Badge } from "../components/ui";

interface Def {
  id?: string;
  module: string;
  field_name: string;
  field_label: string;
  field_type: string;
  options: string[] | string | null;
  is_required: string;
  default_value: string | null;
  display_order: number;
  active: string;
}

const MODULES = ["LEDGER", "PARTY", "ITEM"];

export function CustomFields() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("CUSTOM_FIELD", "write");
  const [rows, setRows] = useState<Def[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("ALL");

  async function load() {
    setLoading(true);
    const r = await api.get("/custom-fields");
    setRows(envelopeResult<Def[]>(r) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function upd(i: number, patch: Partial<Def>) {
    setRows((x) => x.map((y, j) => (j === i ? { ...y, ...patch } : y)));
  }

  async function save() {
    for (const d of rows.filter((x) => x.active !== "N")) {
      if (!d.field_name.trim()) {
        toast({ title: "Every field needs an internal name", tone: "error" });
        return;
      }
    }
    const payload = rows.map((d) => ({
      ...d,
      field_label: d.field_label || d.field_name,
      options: Array.isArray(d.options) ? JSON.stringify(d.options) : d.options || null,
    }));
    const r = await api.post("/custom-fields/bulk-save", payload);
    toast({ title: envelopeOk(r) ? "Custom fields saved" : "Could not save", desc: envelopeOk(r) ? "They now appear on the target master forms." : envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    load();
  }

  const visible = rows.filter((d) => d.active !== "N" && (moduleFilter === "ALL" || d.module === moduleFilter));

  return (
    <PageHeader
      title="Custom Field Framework"
      sub="Extend Ledger, Party and Item masters with customer-specific fields — no code required"
      actions={
        canWrite && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              onClick={() => setRows((r) => [...r, { module: moduleFilter === "ALL" ? "LEDGER" : moduleFilter, field_name: "", field_label: "", field_type: "TEXT", options: null, is_required: "N", default_value: null, display_order: r.length + 1, active: "Y" }])}>
              <Plus className="h-4 w-4 mr-1.5" />Add field
            </Button>
            <Button size="sm" onClick={save}><Check className="h-4 w-4 mr-1.5" />Save</Button>
          </div>
        )
      }
    >
      <Panel
        pad={false}
        title={`${visible.length} field definitions`}
        right={
          <Select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="h-9 w-36 bg-card">
            <option value="ALL">All modules</option>
            {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th className="w-28">Module</Th>
                <Th className="w-36">Internal name</Th>
                <Th>Label</Th>
                <Th className="w-28">Type</Th>
                <Th>Options (for select)</Th>
                <Th className="w-24">Required</Th>
                <Th right className="w-20">Order</Th>
                <Th className="w-14" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && <EmptyRow colSpan={8} text="No custom fields yet — add one to extend a master form." />}
              {rows.map((d, i) => {
                if (d.active === "N" || (moduleFilter !== "ALL" && d.module !== moduleFilter)) return null;
                return (
                  <tr key={d.id || `n-${i}`} className="hover:bg-muted/30 align-top">
                    <Td>
                      <Select disabled={!canWrite} className="h-8" value={d.module} onChange={(e) => upd(i, { module: e.target.value })}>
                        {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </Select>
                    </Td>
                    <Td>
                      <Input disabled={!canWrite} className="h-8 mono" placeholder="region" value={d.field_name} onChange={(e) => upd(i, { field_name: e.target.value.replace(/\s+/g, "_").toLowerCase() })} />
                    </Td>
                    <Td>
                      <Input disabled={!canWrite} className="h-8" placeholder="Region" value={d.field_label || ""} onChange={(e) => upd(i, { field_label: e.target.value })} />
                    </Td>
                    <Td>
                      <Select disabled={!canWrite} className="h-8" value={d.field_type} onChange={(e) => upd(i, { field_type: e.target.value })}>
                        <option value="TEXT">Text</option>
                        <option value="NUMBER">Number</option>
                        <option value="DATE">Date</option>
                        <option value="SELECT">Select</option>
                      </Select>
                    </Td>
                    <Td>
                      {d.field_type === "SELECT" ? (
                        <Input disabled={!canWrite} className="h-8" placeholder="North, South, East"
                          value={Array.isArray(d.options) ? d.options.join(", ") : d.options || ""}
                          onChange={(e) => upd(i, { options: JSON.stringify(e.target.value.split(",").map((s) => s.trim()).filter(Boolean)) })} />
                      ) : (
                        <span className="text-muted-foreground text-[12px]">—</span>
                      )}
                    </Td>
                    <Td>
                      <Select disabled={!canWrite} className="h-8" value={d.is_required} onChange={(e) => upd(i, { is_required: e.target.value })}>
                        <option value="N">Optional</option>
                        <option value="Y">Required</option>
                      </Select>
                    </Td>
                    <Td right>
                      <Input type="number" disabled={!canWrite} className="h-8 w-16 text-right ml-auto" value={d.display_order} onChange={(e) => upd(i, { display_order: +e.target.value || 0 })} />
                    </Td>
                    <Td>
                      {canWrite && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setRows((x) => (d.id ? x.map((y, j) => (j === i ? { ...y, active: "N" } : y)) : x.filter((_, j) => j !== i)))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>
      <p className="text-[12px] text-muted-foreground mt-3">
        <Badge tone="ok">Live</Badge> Custom fields defined here render automatically inside the Ledger master form (Advanced section) and are stored as JSON on the record.
      </p>
    </PageHeader>
  );
}
