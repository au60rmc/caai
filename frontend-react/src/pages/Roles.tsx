import { Fragment, useEffect, useMemo, useState } from "react";
import { Plus, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { cn } from "../lib/format";
import {
  Button,
  Field,
  Input,
  PageHeader,
  Panel,
  SearchBox,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  RowActions,
  Drawer,
  ConfirmDialog,
  Spinner,
} from "../components/ui";

interface Perm {
  feature_id: string;
  feature_name?: string;
  allow_view: string;
  allow_write: string;
  allow_delete: string;
}
interface Role {
  id: string;
  role_code: string;
  role_name: string;
  active: string;
  permissions: Perm[];
}
interface Feature {
  id: string;
  feature_name: string;
  feature_code: string;
  module_name?: string;
}
type Flags = { view: boolean; write: boolean; delete: boolean };

export function Roles() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("USER_ROLE", "write");
  const canDelete = can("USER_ROLE", "delete");

  const [roles, setRoles] = useState<Role[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<{ id: string | null; role_code: string; role_name: string }>({
    id: null,
    role_code: "",
    role_name: "",
  });
  const [perms, setPerms] = useState<Record<string, Flags>>({});
  const [submitted, setSubmitted] = useState(false);
  const [toDelete, setToDelete] = useState<Role | null>(null);

  async function load() {
    setLoading(true);
    const [rr, fr] = await Promise.all([api.get("/roles"), api.get("/features")]);
    setRoles(rr.ok && Array.isArray(rr.data) ? rr.data : []);
    setFeatures(fr.ok && Array.isArray(fr.data) ? fr.data : []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = roles.filter((r) => `${r.role_code} ${r.role_name}`.toLowerCase().includes(q.toLowerCase()));

  const grouped = useMemo(() => {
    const m = new Map<string, Feature[]>();
    for (const f of features) {
      const k = f.module_name || "Other";
      m.set(k, [...(m.get(k) || []), f]);
    }
    return [...m.entries()];
  }, [features]);

  function openNew() {
    setForm({ id: null, role_code: "", role_name: "" });
    setPerms({});
    setSubmitted(false);
    setDrawer(true);
  }
  function openEdit(r: Role) {
    setForm({ id: r.id, role_code: r.role_code, role_name: r.role_name });
    const p: Record<string, Flags> = {};
    for (const perm of r.permissions || []) {
      p[perm.feature_id] = {
        view: perm.allow_view === "Y",
        write: perm.allow_write === "Y",
        delete: perm.allow_delete === "Y",
      };
    }
    setPerms(p);
    setSubmitted(false);
    setDrawer(true);
  }

  function toggle(fid: string, type: keyof Flags, checked: boolean) {
    setPerms((p) => {
      const cur = p[fid] || { view: false, write: false, delete: false };
      const next = { ...cur, [type]: checked };
      if ((type === "write" || type === "delete") && checked) next.view = true;
      if (type === "view" && !checked) {
        next.write = false;
        next.delete = false;
      }
      return { ...p, [fid]: next };
    });
  }

  async function save() {
    setSubmitted(true);
    if (!form.role_code.trim() || !form.role_name.trim()) return;
    const permissions = features
      .map((f) => ({ f, flags: perms[f.id] }))
      .filter(({ flags }) => flags && (flags.view || flags.write || flags.delete))
      .map(({ f, flags }) => ({
        feature_id: f.id,
        allow_view: flags!.view ? "Y" : "N",
        allow_write: flags!.write ? "Y" : "N",
        allow_delete: flags!.delete ? "Y" : "N",
      }));
    if (permissions.length === 0) {
      toast({ title: "Grant at least one permission", tone: "error" });
      return;
    }
    const payload = {
      id: form.id || undefined,
      role_code: form.role_code.trim().toUpperCase(),
      role_name: form.role_name.trim(),
      active: "Y",
      permissions,
    };
    const r = await api.post("/roles", payload);
    if (!r.ok) {
      toast({ title: "Could not save", desc: r.data?.detail || "", tone: "error" });
      return;
    }
    toast({ title: form.id ? "Role updated" : "Role created", tone: "success" });
    setDrawer(false);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const r = await api.del(`/roles/${toDelete.id}`);
    if (!r.ok) {
      toast({ title: "Could not delete", desc: r.data?.detail || "", tone: "error" });
      return;
    }
    toast({ title: "Role deleted", tone: "success" });
    load();
  }

  return (
    <PageHeader
      title="Roles & Permissions"
      sub="Feature-level access control per role"
      actions={
        canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            New role
          </Button>
        )
      }
    >
      <Panel pad={false} title={`${filtered.length} roles`} right={<SearchBox value={q} onChange={setQ} placeholder="Search roles" />}>
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Role</Th>
                <Th>Code</Th>
                <Th right>Features granted</Th>
                <Th className="w-32" right>
                  Actions
                </Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={5} />}
              {filtered.map((r) => {
                const granted = (r.permissions || []).filter((p) => p.allow_view === "Y").length;
                const open = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="hover:bg-muted/40 cursor-pointer" onClick={() => setExpanded(open ? null : r.id)}>
                      <Td>
                        <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-90")} />
                      </Td>
                      <Td className="font-medium">{r.role_name}</Td>
                      <Td className="mono text-muted-foreground">{r.role_code}</Td>
                      <Td right className="fig">
                        {granted} / {features.length}
                      </Td>
                      <Td>
                        <div onClick={(e) => e.stopPropagation()}>
                          <RowActions
                            canEdit={canWrite}
                            canDelete={canDelete && r.role_code !== "ADMIN"}
                            onEdit={() => openEdit(r)}
                            onDelete={() => setToDelete(r)}
                          />
                        </div>
                      </Td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={5} className="bg-muted/25 border-b border-border px-6 py-4">
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-1.5">
                            {(r.permissions || []).map((p) => (
                              <div key={p.feature_id} className="flex items-center justify-between text-[12.5px] py-0.5">
                                <span>{p.feature_name}</span>
                                <span className="flex gap-1.5">
                                  {(["allow_view", "allow_write", "allow_delete"] as const).map((k) => (
                                    <span
                                      key={k}
                                      className={cn(
                                        "mono text-[10px] px-1.5 py-0.5 rounded-[3px]",
                                        (p as any)[k] === "Y" ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-muted text-muted-foreground/50"
                                      )}
                                    >
                                      {k.replace("allow_", "").slice(0, 1).toUpperCase()}
                                    </span>
                                  ))}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        wide
        title={form.id ? "Edit role" : "New role"}
        desc="Ticking Edit or Delete automatically grants View."
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{form.id ? "Save changes" : "Create role"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 mb-5">
          <Field label="Role code" required error={submitted && !form.role_code.trim() ? "Required" : undefined}>
            <Input className="mono uppercase" disabled={!!form.id} value={form.role_code} onChange={(e) => setForm({ ...form, role_code: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Role name" required error={submitted && !form.role_name.trim() ? "Required" : undefined}>
            <Input value={form.role_name} onChange={(e) => setForm({ ...form, role_name: e.target.value })} />
          </Field>
        </div>
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th>Feature</Th>
                <Th className="w-20 text-center">View</Th>
                <Th className="w-20 text-center">Edit</Th>
                <Th className="w-20 text-center">Delete</Th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([mod, feats]) => (
                <Fragment key={mod}>
                  <tr>
                    <td colSpan={4} className="px-4 py-2 bg-muted/50 border-b border-border eyebrow">
                      {mod}
                    </td>
                  </tr>
                  {feats.map((f) => {
                    const fl = perms[f.id] || { view: false, write: false, delete: false };
                    return (
                      <tr key={f.id} className="hover:bg-muted/30">
                        <Td>{f.feature_name}</Td>
                        {(["view", "write", "delete"] as const).map((k) => (
                          <Td key={k} className="text-center">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--teal)]"
                              checked={fl[k]}
                              onChange={(e) => toggle(f.id, k, e.target.checked)}
                            />
                          </Td>
                        ))}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Drawer>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Delete role “${toDelete?.role_name}”?`} onConfirm={confirmDelete} />
    </PageHeader>
  );
}
