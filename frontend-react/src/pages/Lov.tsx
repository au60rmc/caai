import { useEffect, useState } from "react";
import { Plus, Trash2, Check } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { cn } from "../lib/format";
import { Button, Input, PageHeader, Panel, Spinner, Td, Th, TableWrap, EmptyRow } from "../components/ui";

interface Row {
  id?: string;
  value: string;
  text: string;
  dispOrder: number;
  active: string;
}

export function Lov() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("LOV", "write");

  const [groups, setGroups] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadGroups() {
    setLoading(true);
    const r = await api.get("/lov/fetchLovGroup");
    const gs = (envelopeResult<string[]>(r) || []).sort();
    setGroups(gs);
    setLoading(false);
    return gs;
  }
  useEffect(() => {
    loadGroups();
  }, []);

  async function selectGroup(g: string) {
    setSelected(g);
    setCreating(false);
    setRowsLoading(true);
    const r = await api.get(`/lov/fetchLovGroupByCode/${encodeURIComponent(g)}`);
    const items = envelopeResult<any[]>(r) || [];
    setRows(
      items.map((i) => ({ id: i.id, value: i.value, text: i.text, dispOrder: i.dispOrder ?? 0, active: i.active || "Y" }))
    );
    setRowsLoading(false);
  }

  function startNewGroup() {
    const code = newGroup.trim().toUpperCase().replace(/\s+/g, "_");
    if (!code) return;
    if (groups.includes(code)) {
      toast({ title: "Group already exists", tone: "error" });
      return;
    }
    setSelected(code);
    setCreating(true);
    setRows([{ value: "", text: "", dispOrder: 1, active: "Y" }]);
    setNewGroup("");
  }

  function addRow() {
    setRows((r) => [...r, { value: "", text: "", dispOrder: (r.length ? r[r.length - 1].dispOrder : 0) + 1, active: "Y" }]);
  }
  function updateRow(idx: number, patch: Partial<Row>) {
    setRows((r) => r.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }
  function removeRow(idx: number) {
    setRows((r) => {
      const row = r[idx];
      if (row.id) return r.map((x, i) => (i === idx ? { ...x, active: "N" } : x));
      return r.filter((_, i) => i !== idx);
    });
  }

  async function save() {
    if (!selected) return;
    const visible = rows.filter((r) => r.active !== "N");
    for (const r of visible) {
      if (!r.value.trim() || !r.text.trim()) {
        toast({ title: "Value and text are required for every row", tone: "error" });
        return;
      }
    }
    const ordered = [...rows].sort((a, b) => (a.active === "N" ? 1 : 0) - (b.active === "N" ? 1 : 0));
    const payload = ordered.map((r) => ({
      id: r.id,
      group: selected,
      value: r.value.trim().toUpperCase(),
      text: r.text.trim(),
      dispOrder: r.dispOrder,
      keyType: "U",
      active: r.active,
    }));
    setSaving(true);
    const r = await api.post("/lov/saveLov", payload);
    setSaving(false);
    if (!envelopeOk(r)) {
      toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: "Saved", tone: "success" });
    const gs = await loadGroups();
    if (gs.includes(selected)) selectGroup(selected);
    else {
      setSelected(null);
      setRows([]);
    }
  }

  return (
    <PageHeader title="List of Values" sub="Reusable dropdown options grouped by code">
      <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">
        <Panel pad={false} title={`${groups.length} groups`}>
          {canWrite && (
            <div className="p-3 border-b border-border flex gap-2">
              <Input
                className="h-8 mono"
                placeholder="GROUP_CODE"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && startNewGroup()}
              />
              <Button size="sm" className="h-8 px-2" onClick={startNewGroup}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          {loading ? (
            <Spinner />
          ) : (
            <ul className="max-h-[440px] overflow-y-auto py-1.5">
              {groups.length === 0 && <li className="px-4 py-6 text-sm text-muted-foreground text-center">No groups.</li>}
              {groups.map((g) => (
                <li key={g}>
                  <button
                    onClick={() => selectGroup(g)}
                    className={cn(
                      "w-full text-left px-4 py-2 text-[13px] mono transition-colors",
                      selected === g && !creating
                        ? "bg-[var(--teal-soft)] text-[var(--teal)] font-semibold"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {g}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          pad={false}
          title={selected ? <span className="mono normal-case">{selected}</span> : "Select a group"}
          right={
            selected &&
            canWrite && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={addRow}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Add value
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Check className="h-4 w-4 mr-1.5" />
                  Save
                </Button>
              </div>
            )
          }
        >
          {!selected ? (
            <div className="py-16 text-center text-sm text-muted-foreground">Choose a group to manage its values.</div>
          ) : rowsLoading ? (
            <Spinner />
          ) : (
            <div className="p-5">
              <TableWrap>
                <thead>
                  <tr>
                    <Th className="w-40">Value</Th>
                    <Th>Display text</Th>
                    <Th right className="w-24">
                      Order
                    </Th>
                    <Th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((r) => r.active !== "N").length === 0 && <EmptyRow colSpan={4} text="No values yet." />}
                  {rows.map((r, idx) =>
                    r.active === "N" ? null : (
                      <tr key={idx}>
                        <Td>
                          <Input className="h-8 mono" value={r.value} disabled={!canWrite} onChange={(e) => updateRow(idx, { value: e.target.value })} />
                        </Td>
                        <Td>
                          <Input className="h-8" value={r.text} disabled={!canWrite} onChange={(e) => updateRow(idx, { text: e.target.value })} />
                        </Td>
                        <Td right>
                          <Input
                            type="number"
                            className="h-8 w-16 text-right ml-auto"
                            value={r.dispOrder}
                            disabled={!canWrite}
                            onChange={(e) => updateRow(idx, { dispOrder: +e.target.value || 0 })}
                          />
                        </Td>
                        <Td>
                          {canWrite && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeRow(idx)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </Td>
                      </tr>
                    )
                  )}
                </tbody>
              </TableWrap>
            </div>
          )}
        </Panel>
      </div>
    </PageHeader>
  );
}
