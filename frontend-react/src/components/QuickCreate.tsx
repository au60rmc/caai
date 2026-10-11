import { useState } from "react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { quickGstinHint } from "../lib/gst";
import { useToast } from "./toast";
import { Button, Field, Input, Modal, Select, ValidationHint } from "./ui";

/** Spec 8.1: quick-create popup with minimum required fields, invoked inline
 *  from voucher / master screens; the new record is handed back to the caller. */
export function QuickCreateLedger({
  open,
  onClose,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  onCreated: (ledger: any) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await api.post("/ledgers/quick-create", { name: name.trim(), category: category || null });
    setBusy(false);
    if (!envelopeOk(r)) {
      toast({ title: "Could not create ledger", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    const led = envelopeResult<any>(r);
    toast({ title: "Ledger created", desc: led.name, tone: "success" });
    onCreated(led);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick-create ledger"
      desc="Name and category are enough — the group is auto-suggested."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>Create & use</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Ledger name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Auto-detect</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
            <option value="customer">Customer</option>
            <option value="vendor">Vendor</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="tax">Duties & taxes</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function QuickCreateParty({
  open,
  onClose,
  kind,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  kind: "C" | "V";
  initialName?: string;
  onCreated: (party: any) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [gstin, setGstin] = useState("");
  const [busy, setBusy] = useState(false);
  const hint = quickGstinHint(gstin);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await api.post("/parties/quick-create", {
      name: name.trim(),
      key_group: kind,
      gstin: gstin.trim() || null,
    });
    setBusy(false);
    if (!envelopeOk(r)) {
      toast({ title: "Could not create", desc: envelopeMessage(r), tone: "error" });
      return;
    }
    const p = envelopeResult<any>(r);
    toast({ title: kind === "C" ? "Customer created" : "Vendor created", desc: name, tone: "success" });
    onCreated(p);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kind === "C" ? "Quick-create customer" : "Quick-create vendor"}
      desc="A linked ledger is auto-created and mapped to Sundry Debtors/Creditors."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>Create & use</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="GSTIN (optional)">
          <Input className="mono uppercase" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
          <ValidationHint level={hint?.level} message={hint?.message} />
        </Field>
      </div>
    </Modal>
  );
}

export function QuickCreateItem({
  open,
  onClose,
  initialName = "",
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  initialName?: string;
  onCreated: (item: any) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [hsn, setHsn] = useState("");
  const [gst, setGst] = useState("18");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    const r = await api.post("/items/quick-create", {
      item_name: name.trim(),
      hsn_sac: hsn || null,
      gst_percent: gst ? Number(gst) : 0,
    });
    setBusy(false);
    if (!r.ok) {
      toast({ title: "Could not create item", desc: r.data?.detail || "", tone: "error" });
      return;
    }
    toast({ title: "Item created", desc: `${r.data.item_code} · ${name}`, tone: "success" });
    onCreated(r.data);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Quick-create item"
      desc="Item code is auto-generated; refine details later in the Product master."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim()}>Create & use</Button>
        </>
      }
    >
      <div className="grid gap-3">
        <Field label="Item name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="HSN / SAC">
            <Input className="mono" value={hsn} onChange={(e) => setHsn(e.target.value)} />
          </Field>
          <Field label="GST %">
            <Input type="number" value={gst} onChange={(e) => setGst(e.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
