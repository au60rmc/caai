import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { api, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import {
  Button,
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
  RowActions,
  Drawer,
  ConfirmDialog,
  Spinner,
} from "../components/ui";

interface RoleMap {
  user_role_id: string;
  role_name?: string;
}
interface User {
  id: string;
  user_name?: string;
  user_email?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  profession?: string;
  nationality?: string;
  dob?: string;
  alt_email_id?: string;
  user_state?: string;
  user_type?: string;
  roles: RoleMap[];
}
interface Role {
  id: string;
  role_name: string;
  role_code: string;
}

interface CompanyOpt {
  id: string;
  company_name: string;
}

function empty() {
  return {
    id: null as string | null,
    user_name: "",
    user_email: "",
    first_name: "",
    last_name: "",
    gender: "",
    profession: "",
    nationality: "Indian",
    dob: "",
    alt_email_id: "",
    user_state: "",
    password: "",
    roleIds: [] as string[],
    companyIds: [] as string[],
    defaultCompanyId: "" as string,
  };
}
type FormT = ReturnType<typeof empty>;

export function Users() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("USER_MASTER", "write");
  const canDelete = can("USER_MASTER", "delete");

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [form, setForm] = useState<FormT>(empty());
  const [submitted, setSubmitted] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);

  async function load() {
    setLoading(true);
    const [ur, rr, cr] = await Promise.all([
      api.get("/users"),
      api.get("/roles"),
      api.get("/companies?include_all=true"),
    ]);
    setUsers(ur.ok && Array.isArray(ur.data) ? ur.data : []);
    setRoles(rr.ok && Array.isArray(rr.data) ? rr.data : []);
    setCompanies(envelopeResult<CompanyOpt[]>(cr) || (cr.ok && Array.isArray(cr.data) ? cr.data : []));
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        `${u.user_name} ${u.user_email} ${u.first_name} ${u.last_name}`.toLowerCase().includes(q.toLowerCase())
      ),
    [users, q]
  );

  function openNew() {
    const defaultCids = companies.map((c) => c.id);
    setForm({
      ...empty(),
      companyIds: defaultCids,
      defaultCompanyId: defaultCids[0] || "",
    });
    setSubmitted(false);
    setDrawer(true);
  }

  async function openEdit(u: User) {
    let userCids: string[] = [];
    let defaultCid = "";
    try {
      const ucr = await api.get(`/user-companies/${u.id}`);
      if (ucr.ok && Array.isArray(ucr.data)) {
        userCids = ucr.data.map((c: any) => c.company_id);
        const defObj = ucr.data.find((c: any) => c.is_default === "Y");
        if (defObj) defaultCid = defObj.company_id;
      }
    } catch (err) {}

    setForm({
      id: u.id,
      user_name: u.user_name || "",
      user_email: u.user_email || "",
      first_name: u.first_name || "",
      last_name: u.last_name || "",
      gender: u.gender || "",
      profession: u.profession || "",
      nationality: u.nationality || "Indian",
      dob: u.dob || "",
      alt_email_id: u.alt_email_id || "",
      user_state: u.user_state || "",
      password: "",
      roleIds: (u.roles || []).map((r) => r.user_role_id),
      companyIds: userCids,
      defaultCompanyId: defaultCid || userCids[0] || "",
    });
    setSubmitted(false);
    setDrawer(true);
  }

  function toggleRole(id: string, checked: boolean) {
    setForm((f) => ({ ...f, roleIds: checked ? [...f.roleIds, id] : f.roleIds.filter((x) => x !== id) }));
  }

  function toggleCompany(id: string, checked: boolean) {
    setForm((f) => {
      const nextCids = checked ? [...f.companyIds, id] : f.companyIds.filter((x) => x !== id);
      let nextDef = f.defaultCompanyId;
      if (!checked && nextDef === id) {
        nextDef = nextCids[0] || "";
      } else if (checked && !nextDef) {
        nextDef = id;
      }
      return { ...f, companyIds: nextCids, defaultCompanyId: nextDef };
    });
  }

  async function save() {
    setSubmitted(true);
    if (!form.user_name.trim() || !form.user_email.trim() || !form.first_name.trim()) return;
    if (form.roleIds.length === 0) return toast({ title: "Assign at least one role", tone: "error" });
    if (form.companyIds.length === 0) return toast({ title: "Assign at least one company", tone: "error" });
    if (!form.id && form.password.length < 8) return toast({ title: "Set an initial password (min 8 chars)", tone: "error" });

    const user = {
      id: form.id || undefined,
      user_name: form.user_name,
      user_email: form.user_email,
      first_name: form.first_name,
      last_name: form.last_name,
      gender: form.gender || null,
      profession: form.profession || null,
      nationality: form.nationality || null,
      dob: form.dob || null,
      alt_email_id: form.alt_email_id || null,
      user_state: form.user_state || null,
      user_type: "S",
    };
    const body: any = { user, roles: form.roleIds.map((id) => ({ user_role_id: id })) };
    if (form.password) body.password = form.password;

    const r = form.id
      ? await api.put(`/users/${form.id}`, { id: form.id, ...body })
      : await api.post("/users", body);
    if (!r.ok) {
      toast({ title: "Could not save", desc: r.data?.detail || "", tone: "error" });
      return;
    }

    const savedUserId = form.id || r.data?.id;
    if (savedUserId) {
      await api.post(`/user-companies/${savedUserId}`, {
        user_id: savedUserId,
        company_ids: form.companyIds,
        default_company_id: form.defaultCompanyId || form.companyIds[0],
      });
    }

    toast({ title: form.id ? "User updated" : "User created", desc: form.user_name, tone: "success" });
    setDrawer(false);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    const r = await api.del(`/users/${toDelete.id}`);
    if (!r.ok) {
      toast({ title: "Could not delete", desc: r.data?.detail || "", tone: "error" });
      return;
    }
    toast({ title: "User removed", tone: "success" });
    load();
  }

  return (
    <PageHeader
      title="Users"
      sub="Team members and their role assignments"
      actions={
        canWrite && (
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1.5" />
            New user
          </Button>
        )
      }
    >
      <Panel pad={false} title={`${filtered.length} users`} right={<SearchBox value={q} onChange={setQ} placeholder="Search users" />}>
        {loading ? (
          <Spinner />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>User</Th>
                <Th>Email</Th>
                <Th>Roles</Th>
                <Th className="w-32" right>
                  Actions
                </Th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <EmptyRow colSpan={4} />}
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-muted/40">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <span className="h-8 w-8 rounded-full grid place-items-center text-white text-[11px] font-semibold shrink-0" style={{ background: "var(--ink-3)" }}>
                        {(u.first_name?.[0] || "") + (u.last_name?.[0] || "")}
                      </span>
                      <div>
                        <div className="font-medium">
                          {u.first_name} {u.last_name}
                        </div>
                        <div className="mono text-[11px] text-muted-foreground">{u.user_name}</div>
                      </div>
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{u.user_email}</Td>
                  <Td>{(u.roles || []).map((r) => r.role_name).filter(Boolean).join(", ") || "—"}</Td>
                  <Td>
                    <RowActions canEdit={canWrite} canDelete={canDelete} onEdit={() => openEdit(u)} onDelete={() => setToDelete(u)} />
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
        title={form.id ? "Edit user" : "New user"}
        desc="Profile, password and role assignments."
        footer={
          <>
            <Button variant="outline" onClick={() => setDrawer(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{form.id ? "Save changes" : "Create user"}</Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Username" required error={submitted && !form.user_name.trim() ? "Required" : undefined}>
            <Input className="mono" value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })} />
          </Field>
          <Field label="Email" required error={submitted && !form.user_email.trim() ? "Required" : undefined}>
            <Input type="email" value={form.user_email} onChange={(e) => setForm({ ...form, user_email: e.target.value })} />
          </Field>
          <Field label="First name" required error={submitted && !form.first_name.trim() ? "Required" : undefined}>
            <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
          </Field>
          <Field label="Last name">
            <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </Field>
          <Field label="Gender">
            <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
              <option value="O">Other</option>
            </Select>
          </Field>
          <Field label="Date of birth">
            <DatePicker value={form.dob} onChange={(val) => setForm({ ...form, dob: val })} />
          </Field>
          <Field label="Profession">
            <Input value={form.profession} onChange={(e) => setForm({ ...form, profession: e.target.value })} />
          </Field>
          <Field label="Nationality">
            <Input value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
          </Field>
          <Field label={form.id ? "Reset password" : "Password *"} className="col-span-2">
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={form.id ? "Leave blank to keep current" : "Set an initial password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">The user will be asked to change it on first login.</p>
          </Field>
        </div>

        <div className="mt-5">
          <div className="eyebrow mb-2.5">Roles</div>
          <div className="rounded-md border border-border divide-y divide-border">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-muted/40 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--teal)]"
                  checked={form.roleIds.includes(r.id)}
                  onChange={(e) => toggleRole(r.id, e.target.checked)}
                />
                <span className="text-[13px] font-medium">{r.role_name}</span>
                <span className="mono text-[11px] text-muted-foreground ml-auto">{r.role_code}</span>
              </label>
            ))}
          </div>
          {submitted && form.roleIds.length === 0 && <p className="text-xs text-destructive mt-1.5">Assign at least one role.</p>}
        </div>

        <div className="mt-5">
          <div className="eyebrow mb-2.5">Company Access</div>
          <div className="rounded-md border border-border divide-y divide-border">
            {companies.map((c) => {
              const isChecked = form.companyIds.includes(c.id);
              const isDefault = form.defaultCompanyId === c.id;
              return (
                <div key={c.id} className="flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/40">
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--teal)]"
                      checked={isChecked}
                      onChange={(e) => toggleCompany(c.id, e.target.checked)}
                    />
                    <span className="text-[13px] font-medium">{c.company_name}</span>
                  </label>
                  {isChecked && (
                    <label className="flex items-center gap-1.5 text-[11.5px] cursor-pointer text-muted-foreground hover:text-foreground">
                      <input
                        type="radio"
                        name="default_company_radio"
                        className="accent-[var(--teal)]"
                        checked={isDefault}
                        onChange={() => setForm((f) => ({ ...f, defaultCompanyId: c.id }))}
                      />
                      <span>{isDefault ? "Default company" : "Set default"}</span>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {submitted && form.companyIds.length === 0 && <p className="text-xs text-destructive mt-1.5">Assign at least one company.</p>}
        </div>
      </Drawer>

      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Remove ${toDelete?.first_name} ${toDelete?.last_name}?`} onConfirm={confirmDelete} />
    </PageHeader>
  );
}
