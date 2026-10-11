import { useEffect, useState } from "react";
import { Plus, Check, Calculator } from "lucide-react";
import { api, envelopeOk, envelopeMessage, envelopeResult } from "../lib/api";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/toast";
import { money } from "../lib/format";
import {
  Button, Field, Input, Select, PageHeader, Panel, SearchBox, TableWrap, Th, Td,
  EmptyRow, Badge, Spinner, ValidationHint,
} from "../components/ui";

interface Rate { id?: string; rate: number; tax_type: string; description: string | null; active: string; }
interface Hsn { id?: string; code: string; description: string | null; gst_rate: number | null; kind: string; active: string; }
interface StateRow { code: string; name: string; }

export function GstSetup() {
  const { can } = useAuth();
  const { toast } = useToast();
  const canWrite = can("GST_SETUP", "write");

  const [tab, setTab] = useState<"rates" | "hsn" | "tools">("rates");
  const [rates, setRates] = useState<Rate[]>([]);
  const [hsn, setHsn] = useState<Hsn[]>([]);
  const [states, setStates] = useState<StateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hsnQ, setHsnQ] = useState("");

  // GSTIN checker + classifier tools
  const [gstin, setGstin] = useState("");
  const [gstinResult, setGstinResult] = useState<any | null>(null);
  const [clf, setClf] = useState({ supplier: "33", pos: "33", rate: "18", amount: "10000" });
  const [clfResult, setClfResult] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const [rr, hr, sr] = await Promise.all([
      api.get("/gst/rates"),
      api.get("/gst/hsn"),
      api.get("/gst/states"),
    ]);
    setRates(envelopeResult<Rate[]>(rr) || []);
    setHsn(envelopeResult<Hsn[]>(hr) || []);
    setStates(envelopeResult<StateRow[]>(sr) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (gstin.length !== 15) {
      setGstinResult(null);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api.get(`/gst/validate/${encodeURIComponent(gstin)}`);
      setGstinResult(envelopeResult<any>(r));
    }, 300);
    return () => clearTimeout(t);
  }, [gstin]);

  async function classify() {
    const r = await api.post("/gst/classify", {
      supplier_state_code: clf.supplier,
      place_of_supply_state_code: clf.pos,
      rate: Number(clf.rate),
      taxable_amount: Number(clf.amount),
    });
    setClfResult(envelopeResult<any>(r));
  }

  async function saveRates() {
    const r = await api.post("/gst/rates/bulk-save", rates.map((x) => ({ ...x, description: x.description || null })));
    toast({ title: envelopeOk(r) ? "GST rates saved" : "Could not save", desc: envelopeOk(r) ? "" : envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    load();
  }
  async function saveHsn() {
    for (const h of hsn) {
      if (!h.code.trim()) {
        toast({ title: "Every HSN row needs a code", tone: "error" });
        return;
      }
    }
    const r = await api.post("/gst/hsn/bulk-save", hsn);
    toast({ title: envelopeOk(r) ? "HSN/SAC saved" : "Could not save", desc: envelopeOk(r) ? "" : envelopeMessage(r), tone: envelopeOk(r) ? "success" : "error" });
    load();
  }

  const hsnFiltered = hsn.filter((h) =>
    `${h.code} ${h.description || ""}`.toLowerCase().includes(hsnQ.toLowerCase())
  );

  return (
    <PageHeader title="GST Setup" sub="Tax rates, HSN/SAC reference data, GSTIN checker and CGST/SGST vs IGST classification">
      <Panel pad={false} title="Tax configuration">
        <div className="px-5 pt-3 flex items-center gap-2 flex-wrap">
          {(["rates", "hsn", "tools"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={
                "px-3 py-1.5 rounded-md text-sm font-medium " +
                (tab === t ? "bg-secondary text-secondary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")
              }
            >
              {t === "rates" ? "GST rates" : t === "hsn" ? "HSN / SAC" : "Validation tools"}
            </button>
          ))}
          {canWrite && tab === "rates" && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setRates((r) => [...r, { rate: 0, tax_type: "BOTH", description: "", active: "Y" }])}>
                <Plus className="h-4 w-4 mr-1.5" />Add rate
              </Button>
              <Button size="sm" onClick={saveRates}><Check className="h-4 w-4 mr-1.5" />Save</Button>
            </div>
          )}
          {canWrite && tab === "hsn" && (
            <div className="ml-auto flex gap-2 items-center">
              <SearchBox value={hsnQ} onChange={setHsnQ} placeholder="Search code / description" />
              <Button size="sm" variant="outline" onClick={() => setHsn((h) => [{ code: "", description: "", gst_rate: 18, kind: "G", active: "Y" }, ...h])}>
                <Plus className="h-4 w-4 mr-1.5" />Add
              </Button>
              <Button size="sm" onClick={saveHsn}><Check className="h-4 w-4 mr-1.5" />Save</Button>
            </div>
          )}
        </div>

        <div className="p-5 pt-3">
          {loading ? (
            <Spinner />
          ) : tab === "rates" ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th right className="w-28">Rate %</Th>
                  <Th className="w-36">Applies to</Th>
                  <Th>Description</Th>
                  <Th className="w-40">Split (intra-state)</Th>
                </tr>
              </thead>
              <tbody>
                {rates.length === 0 && <EmptyRow colSpan={4} />}
                {rates.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-muted/30">
                    <Td right>
                      <Input type="number" step="0.25" disabled={!canWrite} className="h-8 w-24 text-right ml-auto fig" value={r.rate}
                        onChange={(e) => setRates((x) => x.map((y, j) => (j === i ? { ...y, rate: +e.target.value } : y)))} />
                    </Td>
                    <Td>
                      <Select disabled={!canWrite} className="h-8" value={r.tax_type}
                        onChange={(e) => setRates((x) => x.map((y, j) => (j === i ? { ...y, tax_type: e.target.value } : y)))}>
                        <option value="BOTH">Goods & services</option>
                        <option value="GOODS">Goods</option>
                        <option value="SERVICE">Services</option>
                      </Select>
                    </Td>
                    <Td>
                      <Input disabled={!canWrite} className="h-8" value={r.description || ""}
                        onChange={(e) => setRates((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                    </Td>
                    <Td className="mono text-muted-foreground">CGST {r.rate / 2}% + SGST {r.rate / 2}%</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : tab === "hsn" ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th className="w-32">Code</Th>
                  <Th className="w-24">Kind</Th>
                  <Th>Description</Th>
                  <Th right className="w-28">GST %</Th>
                </tr>
              </thead>
              <tbody>
                {hsnFiltered.length === 0 && <EmptyRow colSpan={4} text="No HSN/SAC records." />}
                {hsnFiltered.map((h) => {
                  const i = hsn.indexOf(h);
                  return (
                    <tr key={h.id || `new-${i}`} className="hover:bg-muted/30">
                      <Td>
                        <Input disabled={!canWrite} className="h-8 mono w-28" value={h.code}
                          onChange={(e) => setHsn((x) => x.map((y, j) => (j === i ? { ...y, code: e.target.value } : y)))} />
                      </Td>
                      <Td>
                        <Select disabled={!canWrite} className="h-8" value={h.kind}
                          onChange={(e) => setHsn((x) => x.map((y, j) => (j === i ? { ...y, kind: e.target.value } : y)))}>
                          <option value="G">HSN</option>
                          <option value="S">SAC</option>
                        </Select>
                      </Td>
                      <Td>
                        <Input disabled={!canWrite} className="h-8" value={h.description || ""}
                          onChange={(e) => setHsn((x) => x.map((y, j) => (j === i ? { ...y, description: e.target.value } : y)))} />
                      </Td>
                      <Td right>
                        <Input type="number" disabled={!canWrite} className="h-8 w-20 text-right ml-auto fig" value={h.gst_rate ?? ""}
                          onChange={(e) => setHsn((x) => x.map((y, j) => (j === i ? { ...y, gst_rate: e.target.value === "" ? null : +e.target.value } : y)))} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          ) : (
            <div className="grid lg:grid-cols-2 gap-5">
              <div className="card-panel p-5">
                <div className="eyebrow pb-3 ledger-rule">GSTIN checker</div>
                <div className="pt-3 space-y-3">
                  <Field label="GSTIN">
                    <Input className="mono uppercase" maxLength={15} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="33AAAAA0000A1Z5" />
                  </Field>
                  {gstinResult && (
                    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5 fade-up">
                      <ValidationHint level={gstinResult.level === "ok" ? "ok" : gstinResult.level} message={gstinResult.message} />
                      {gstinResult.state_name && (
                        <div className="text-[12.5px]">
                          <span className="text-muted-foreground">State:</span> {gstinResult.state_code} · {gstinResult.state_name}
                        </div>
                      )}
                      {gstinResult.pan && (
                        <div className="text-[12.5px]">
                          <span className="text-muted-foreground">Embedded PAN:</span> <span className="mono">{gstinResult.pan}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="card-panel p-5">
                <div className="eyebrow pb-3 ledger-rule">CGST/SGST vs IGST classifier</div>
                <div className="pt-3 grid grid-cols-2 gap-3">
                  <Field label="Supplier state">
                    <Select value={clf.supplier} onChange={(e) => setClf({ ...clf, supplier: e.target.value })}>
                      {states.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="Place of supply">
                    <Select value={clf.pos} onChange={(e) => setClf({ ...clf, pos: e.target.value })}>
                      {states.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}
                    </Select>
                  </Field>
                  <Field label="GST rate %">
                    <Input type="number" value={clf.rate} onChange={(e) => setClf({ ...clf, rate: e.target.value })} />
                  </Field>
                  <Field label="Taxable amount">
                    <Input type="number" value={clf.amount} onChange={(e) => setClf({ ...clf, amount: e.target.value })} />
                  </Field>
                  <div className="col-span-2">
                    <Button size="sm" onClick={classify}><Calculator className="h-4 w-4 mr-1.5" />Classify</Button>
                  </div>
                  {clfResult && (
                    <div className="col-span-2 rounded-md border border-border bg-muted/30 p-3 fade-up">
                      <Badge tone={clfResult.classification === "IGST" ? "warn" : "ok"}>{clfResult.classification.replace("_", " + ")}</Badge>
                      <div className="mt-2 space-y-1 text-[12.5px]">
                        {clfResult.classification === "CGST_SGST" ? (
                          <>
                            <div className="flex justify-between"><span className="text-muted-foreground">CGST @ {clfResult.cgst_rate}%</span><span className="fig">{money(clfResult.cgst_amount)}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">SGST @ {clfResult.sgst_rate}%</span><span className="fig">{money(clfResult.sgst_amount)}</span></div>
                          </>
                        ) : (
                          <div className="flex justify-between"><span className="text-muted-foreground">IGST @ {clfResult.igst_rate}%</span><span className="fig">{money(clfResult.igst_amount)}</span></div>
                        )}
                        <div className="flex justify-between font-semibold pt-1 ledger-rule-strong"><span>Total tax</span><span className="fig">{money(clfResult.total_tax)}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </PageHeader>
  );
}
