import { useEffect, useState } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { Button, Input, PageHeader, Panel, TableWrap, Th, Td, EmptyRow, Spinner } from "../components/ui";

interface Unit { id?: string; unit_name: string; unit_symbol: string; active: string; }

export function Units() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("UNITS", "write");
  const [rows, setRows] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const r = await api.get("/units");
    setRows(envelopeResult<Unit[]>(r) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function save() {
    for (const u of rows.filter((x) => x.active !== "N")) {
      if (!u.unit_name.trim() || !u.unit_symbol.trim()) {
        toast({ title: "Name and symbol are required for every unit", tone: "error" });
        return;
      }
    }
    const r = await api.post("/units/bulk-save", rows);
    toast({ title: envelopeOk(r) ? "Units saved" : "Could not save", desc: envelopeOk(r) ? "" : envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    load();
  }

  return (
    <PageHeader
      title="Units of Measure"
      sub="Units used across the item master and vouchers"
      actions={
        canWrite && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setRows((r) => [...r, { unit_name: "", unit_symbol: "", active: "Y" }])}>
              <Plus className="h-4 w-4 mr-1.5" />Add unit
            </Button>
            <Button size="sm" onClick={save}><Check className="h-4 w-4 mr-1.5" />Save</Button>
          </div>
        )
      }
    >
      <Panel pad={false} title={`${rows.filter((r) => r.active !== "N").length} units`}>
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Unit name</Th>
                <Th className="w-40">Symbol</Th>
                <Th className="w-16" />
              </tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.active !== "N").length === 0 && <EmptyRow colSpan={3} />}
              {rows.map((u, i) =>
                u.active === "N" ? null : (
                  <tr key={u.id || `n-${i}`} className="hover:bg-muted/30">
                    <Td>
                      <Input disabled={!canWrite} className="h-8 max-w-sm" value={u.unit_name}
                        onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, unit_name: e.target.value } : y)))} />
                    </Td>
                    <Td>
                      <Input disabled={!canWrite} className="h-8 mono w-28 uppercase" value={u.unit_symbol}
                        onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, unit_symbol: e.target.value.toUpperCase() } : y)))} />
                    </Td>
                    <Td>
                      {canWrite && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            setRows((x) =>
                              u.id ? x.map((y, j) => (j === i ? { ...y, active: "N" } : y)) : x.filter((_, j) => j !== i)
                            )
                          }>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </Td>
                  </tr>
                )
              )}
            </tbody>
          </TableWrap>
        )}
      </Panel>
    </PageHeader>
  );
}
