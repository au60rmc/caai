import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Plus } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { ActivityDrawer } from "../components/ActivityDrawer";
import {
  Button, Field, Input, Select, PageHeader, Panel, SearchBox, TableWrap, Th, Td,
  EmptyRow, Badge, RowActions, Drawer, ConfirmDialog, Spinner,
} from "../components/ui";

interface CostCenter {
  id: string;
  name: string;
  code: string | null;
  kind: string;
  parent_id: string | null;
  active: string;
}

const empty = () => ({ id: null as string | null, name: "", code: "", kind: "DEPARTMENT", parent_id: "" });

export function CostCenters() {
  const { can } = useAuth();
  const { toast } = useToast();
  const loc = useLocation();
  const canWrite = can("COST_CENTER", "write");
  const canDelete = can("COST_CENTER", "delete");

  const [rows, setRows] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState("ALL");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState(empty());
  const [submitted, setSubmitted] = useState(false);
  const [toDelete, setToDelete] = useState<CostCenter | null>(null);
  const [auditFor, setAuditFor] = useState<CostCenter | null>(null);

  async function load() {
    setLoading(true);
    const r = await api.get("/cost-centers");
    setRows(envelopeResult<CostCenter[]>(r) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if ((loc.state as any)?.openNew && canWrite) openNew();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map(rows.map((c) => [c.id, c])), [rows]);
  const filtered = rows.filter(
    (c) =>
      (kindFilter === "ALL" || c.kind === kindFilter) &&
      `${c.name} ${c.code || ""}`.toLowerCase().includes(q.toLowerCase())
  );

  function openNew() {
    setForm(empty());
    setSubmitted(false);
    setDrawer(true);
  }
  function openEdit(c: CostCenter) {
    setForm({ id: c.id, name: c.name, code: c.code || "", kind: c.kind, parent_id: c.parent_id || "" });
    setSubmitted(false);
    setDrawer(true);
  }

  async function save() {
    setSubmitted(true);
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      code: form.code || null,
      kind: form.kind,
      parent_id: form.parent_id || null,
      active: "Y",
    };
    const r = form.id ? await api.put(`/cost-centers/${form.id}`, payload) : await api.post("/cost-centers", payload);
    if (!envelopeOk(r)) {
      toast({ title: "Could not save", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: form.id ? "Cost center updated" : "Cost center created", desc: form.name, tone: "success" });
    setDrawer(false);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const r = await api.del(`/cost-centers/${toDelete.id}`);
    if (!envelopeOk(r)) {
      toast({ title: "Could not remove", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    toast({ title: "Cost center removed", tone: "success" });
    load();
  }

  const kindTone = (k: string) => (k === "BRANCH" ? "warn" : k === "PROJECT" ? "muted" : "ok");

  return (
    <PageHeader
      title="Cost Center / Project Master"
      sub="Departments, projects and branches for MIS, profitability and branch/project reporting"
      actions={
        canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            New cost center
          </Button>
        )
      }
    >
      <Panel
        pad={false}
        title={`${filtered.length} dimensions`}
        right={
          <div className="flex items-center gap-2">
            <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className="h-9 w-36 bg-card">
              <option value="ALL">All kinds</option>
              <option value="DEPARTMENT">Departments</option>
              <option value="PROJECT">Projects</option>
              <option value="BRANCH">Branches</option>
            </Select>
            <SearchBox value={q} onChange={setQ} placeholder="Search" />
          </div>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th className="w-24">Code</Th>
                <Th className="w-32">Kind</Th>
                <Th>Parent</Th>
                <Th className="w-44" right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={5} />}
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/40">
                  <Td className="font-medium">{c.name}</Td>
                  <Td className="mono text-muted-foreground">{c.code || "—"}</Td>
                  <Td><Badge tone={kindTone(c.kind) as any}>{c.kind.toLowerCase()}</Badge></Td>
                  <Td className="text-muted-foreground">{c.parent_id ? byId.get(c.parent_id)?.name || "—" : "—"}</Td>
                  <Td>
                    <RowActions
                      canEdit={canWrite}
                      canDelete={canDelete}
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
        title={form.id ? "Edit cost center" : "New cost center"}
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>Cancel</Button>
            <Button onClick={save}>{form.id ? "Save changes" : "Create"}</Button>
          </>
        }
      >
        <div className="grid gap-3">
          <Field label="Name" required error={submitted && !form.name.trim() ? "Required" : undefined}>
            <Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Code">
              <Input className="mono uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Kind">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="DEPARTMENT">Department</option>
                <option value="PROJECT">Project</option>
                <option value="BRANCH">Branch</option>
              </Select>
            </Field>
          </div>
          <Field label="Parent (optional)">
            <Select value={form.parent_id} onChange={(e) => setForm({ ...form, parent_id: e.target.value })}>
              <option value="">None</option>
              {rows.filter((c) => c.id !== form.id).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </Drawer>

      <ActivityDrawer
        open={!!auditFor}
        onClose={() => setAuditFor(null)}
        entity="cost_center"
        entityId={auditFor?.id || null}
        title={auditFor?.name || ""}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Remove “${toDelete?.name}”?`}
        confirmLabel="Remove"
        onConfirm={confirmDelete}
      />
    </PageHeader>
  );
}
