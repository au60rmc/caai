import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Scale,
  TrendingUp,
  Landmark,
  Wallet,
  BookText,
  Download,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { api, envelopeResult } from "../lib/api";
import { useCompany } from "../auth/CompanyContext";
import { money, fmtDate } from "../lib/format";
import { downloadCSV } from "../lib/csv";
import {
  PageHeader,
  Panel,
  Button,
  DatePicker,
  Input,
  TableWrap,
  Th,
  Td,
  EmptyRow,
  Badge,
  Spinner,
  Drawer,
  Money,
} from "../components/ui";

type ReportKey = "trial-balance" | "profit-loss" | "balance-sheet" | "cash-book" | "bank-book" | "day-book";

const REPORTS: { key: ReportKey; label: string; icon: any; range: "asOn" | "period" }[] = [
  { key: "trial-balance", label: "Trial Balance", icon: Scale, range: "asOn" },
  { key: "profit-loss", label: "Profit & Loss", icon: TrendingUp, range: "period" },
  { key: "balance-sheet", label: "Balance Sheet", icon: Landmark, range: "asOn" },
  { key: "cash-book", label: "Cash Book", icon: Wallet, range: "period" },
  { key: "bank-book", label: "Bank Book", icon: Landmark, range: "period" },
  { key: "day-book", label: "Day Book", icon: BookText, range: "period" },
];

function fyStart(): string {
  const t = new Date();
  const y = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
  return `${y}-04-01`;
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Reports() {
  const loc = useLocation();
  const { companyId } = useCompany();
  const [active, setActive] = useState<ReportKey>(((loc.state as any)?.report as ReportKey) || "trial-balance");
  const [fromDate, setFromDate] = useState(fyStart());
  const [toDate, setToDate] = useState(today());
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stmtFor, setStmtFor] = useState<{ id: string; name: string } | null>(null);
  const [stmt, setStmt] = useState<any>(null);

  const def = REPORTS.find((r) => r.key === active)!;

  async function run() {
    setLoading(true);
    const params =
      def.range === "asOn"
        ? `?to_date=${toDate}`
        : `?from_date=${fromDate}&to_date=${toDate}`;
    const r = await api.get(`/reports/${active}${params}`);
    setData(envelopeResult<any>(r));
    setLoading(false);
  }
  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fromDate, toDate, companyId]);

  async function openStatement(id: string, name: string) {
    setStmtFor({ id, name });
    setStmt(null);
    const r = await api.get(`/reports/ledger/${id}?from_date=${fromDate}&to_date=${toDate}`);
    setStmt(envelopeResult<any>(r));
  }

  return (
    <PageHeader
      title="Reports"
      sub="Financial statements and books — generated live from posted vouchers"
      actions={
        <div className="flex items-center gap-2">
          {def.range === "period" && (
            <DatePicker className="w-[150px]" value={fromDate} onChange={(val) => setFromDate(val)} />
          )}
          <span className="text-muted-foreground text-sm">{def.range === "period" ? "to" : "as on"}</span>
          <DatePicker className="w-[150px]" value={toDate} onChange={(val) => setToDate(val)} />
          <Button size="sm" variant="outline" onClick={() => exportReport(active, data, def.label)} disabled={!data}>
            <Download className="h-4 w-4 mr-1.5" />
            Export
          </Button>
        </div>
      }
    >
      <div className="grid lg:grid-cols-[200px_1fr] gap-4 items-start">
        <div className="card-panel p-2">
          {REPORTS.map((r) => (
            <button
              key={r.key}
              onClick={() => setActive(r.key)}
              className={
                "w-full flex items-center gap-2.5 rounded-[5px] px-3 py-2 text-[13px] text-left transition-colors " +
                (active === r.key ? "bg-[var(--teal-soft)] text-[var(--teal)] font-semibold" : "hover:bg-muted")
              }
            >
              <r.icon className="h-4 w-4 shrink-0" />
              {r.label}
            </button>
          ))}
        </div>

        <div>
          {loading || !data ? (
            <Spinner />
          ) : active === "trial-balance" ? (
            <TrialBalanceView data={data} onLedger={openStatement} />
          ) : active === "profit-loss" ? (
            <ProfitLossView data={data} />
          ) : active === "balance-sheet" ? (
            <BalanceSheetView data={data} />
          ) : active === "day-book" ? (
            <DayBookView data={data} />
          ) : (
            <CashBankView data={data} label={def.label} onLedger={openStatement} />
          )}
        </div>
      </div>

      <Drawer
        open={!!stmtFor}
        onClose={() => setStmtFor(null)}
        wide
        title={stmtFor ? `Ledger — ${stmtFor.name}` : ""}
        desc="Running balance from posted vouchers"
      >
        {!stmt ? (
          <Spinner />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <Stat l="Opening" v={stmt.openingBalance} />
              <Stat l="Closing" v={stmt.closingBalance} />
              <Stat l="Entries" v={stmt.lines?.length || 0} plain />
            </div>
            <TableWrap>
              <thead>
                <tr>
                  <Th>Voucher</Th>
                  <Th>Date</Th>
                  <Th>Narration</Th>
                  <Th right>Debit</Th>
                  <Th right>Credit</Th>
                  <Th right>Balance</Th>
                </tr>
              </thead>
              <tbody>
                {(stmt.lines || []).length === 0 && <EmptyRow colSpan={6} text="No transactions in this period." />}
                {(stmt.lines || []).map((l: any, i: number) => (
                  <tr key={i}>
                    <Td className="mono">{l.voucherNo}</Td>
                    <Td>{fmtDate(l.voucherDate)}</Td>
                    <Td className="max-w-[240px] truncate">{l.narration || "—"}</Td>
                    <Td right>{l.debit ? <Money v={l.debit} /> : "—"}</Td>
                    <Td right>{l.credit ? <Money v={l.credit} /> : "—"}</Td>
                    <Td right className="fig">{money(l.balance)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </>
        )}
      </Drawer>
    </PageHeader>
  );
}

function Stat({ l, v, plain }: { l: string; v: number; plain?: boolean }) {
  return (
    <div className="rounded-[5px] border border-border bg-muted/30 px-3.5 py-3">
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{l}</div>
      <div className="fig text-lg mt-0.5">{plain ? v : money(v)}</div>
    </div>
  );
}

function TrialBalanceView({ data, onLedger }: { data: any; onLedger: (id: string, name: string) => void }) {
  return (
    <Panel pad={false} title={`Trial Balance${data.asOn ? ` as on ${fmtDate(data.asOn)}` : ""}`} right={
      <Badge tone={data.balanced ? "ok" : "bad"}>
        {data.balanced ? "Balanced" : "Out of balance"}
      </Badge>
    }>
      <TableWrap>
        <thead>
          <tr>
            <Th>Ledger</Th>
            <Th>Group</Th>
            <Th right>Debit</Th>
            <Th right>Credit</Th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 && <EmptyRow colSpan={4} text="No balances yet — post some vouchers." />}
          {data.rows.map((r: any) => (
            <tr key={r.ledgerId} className="hover:bg-muted/40 cursor-pointer" onClick={() => onLedger(r.ledgerId, r.ledger)}>
              <Td className="font-medium">{r.ledger}</Td>
              <Td className="text-muted-foreground text-[12px]">{r.group}</Td>
              <Td right>{r.debit ? <Money v={r.debit} /> : "—"}</Td>
              <Td right>{r.credit ? <Money v={r.credit} /> : "—"}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="ledger-rule-strong bg-muted/40 font-semibold">
            <td colSpan={2} className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground">Total</td>
            <td className="px-4 py-2.5 text-right fig">{money(data.totalDebit)}</td>
            <td className="px-4 py-2.5 text-right fig">{money(data.totalCredit)}</td>
          </tr>
        </tfoot>
      </TableWrap>
    </Panel>
  );
}

function ProfitLossView({ data }: { data: any }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Panel pad={false} title="Expenses">
        <SideTable rows={data.expense} total={data.expenseTotal} totalLabel="Total expenses" />
      </Panel>
      <Panel pad={false} title="Income">
        <SideTable rows={data.income} total={data.incomeTotal} totalLabel="Total income" />
      </Panel>
      <div className="md:col-span-2">
        <div className="card-panel px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.isProfit ? (
              <CheckCircle2 className="h-5 w-5" style={{ color: "var(--teal)" }} />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[var(--red)]" />
            )}
            <span className="font-semibold">{data.isProfit ? "Net Profit" : "Net Loss"}</span>
            <span className="text-muted-foreground text-[12px]">
              {data.fromDate ? `${fmtDate(data.fromDate)} – ${fmtDate(data.toDate)}` : ""}
            </span>
          </div>
          <span className={"fig text-xl " + (data.isProfit ? "" : "text-[var(--red)]")}>{money(Math.abs(data.netProfit))}</span>
        </div>
      </div>
    </div>
  );
}

function BalanceSheetView({ data }: { data: any }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Panel pad={false} title="Liabilities & Capital" right={<span className="fig text-sm">{money(data.liabilitiesTotal)}</span>}>
        <SideTable rows={data.liabilities} total={data.liabilitiesTotal} totalLabel="Total" />
      </Panel>
      <Panel pad={false} title="Assets" right={<span className="fig text-sm">{money(data.assetsTotal)}</span>}>
        <SideTable rows={data.assets} total={data.assetsTotal} totalLabel="Total" />
      </Panel>
      <div className="md:col-span-2">
        <div className="card-panel px-5 py-3 flex items-center justify-between text-[13px]">
          <span className="text-muted-foreground">{data.asOn ? `As on ${fmtDate(data.asOn)}` : ""}</span>
          <Badge tone={data.balanced ? "ok" : "bad"}>{data.balanced ? "Balanced" : "Out of balance"}</Badge>
        </div>
      </div>
    </div>
  );
}

function SideTable({ rows, total, totalLabel }: { rows: any[]; total: number; totalLabel: string }) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Ledger</Th>
          <Th right>Amount</Th>
        </tr>
      </thead>
      <tbody>
        {(!rows || rows.length === 0) && <EmptyRow colSpan={2} text="Nothing here yet." />}
        {(rows || []).map((r: any, i: number) => (
          <tr key={i}>
            <Td>
              <div className="font-medium">{r.ledger}</div>
              <div className="text-[11px] text-muted-foreground">{r.group}</div>
            </Td>
            <Td right className="fig">{money(r.amount)}</Td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="ledger-rule-strong bg-muted/40 font-semibold">
          <td className="px-4 py-2.5 text-right text-[11px] uppercase tracking-wider text-muted-foreground">{totalLabel}</td>
          <td className="px-4 py-2.5 text-right fig">{money(total)}</td>
        </tr>
      </tfoot>
    </TableWrap>
  );
}

function CashBankView({ data, label, onLedger }: { data: any; label: string; onLedger: (id: string, name: string) => void }) {
  const accounts = data.accounts || [];
  return (
    <div className="space-y-4">
      <div className="card-panel px-5 py-3 flex items-center justify-between text-[13px]">
        <span className="font-semibold">{label}</span>
        <span className="text-muted-foreground">
          Opening {money(data.openingTotal)} · Closing <span className="fig">{money(data.closingTotal)}</span>
        </span>
      </div>
      {accounts.length === 0 && (
        <div className="card-panel p-8 text-center text-muted-foreground text-sm">No matching accounts found.</div>
      )}
      {accounts.map((acc: any) => (
        <Panel
          key={acc.ledgerId}
          pad={false}
          title={
            <button className="text-[var(--teal)] hover:underline" onClick={() => onLedger(acc.ledgerId, acc.ledger)}>
              {acc.ledger}
            </button>
          }
          right={<span className="text-[12px] text-muted-foreground">Closing <span className="fig">{money(acc.closingBalance)}</span></span>}
        >
          <TableWrap>
            <thead>
              <tr>
                <Th>Voucher</Th>
                <Th>Date</Th>
                <Th>Narration</Th>
                <Th right>Debit</Th>
                <Th right>Credit</Th>
                <Th right>Balance</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-muted/20">
                <Td className="text-muted-foreground text-[12px]" >Opening balance</Td>
                <Td /><Td /><Td /><Td />
                <Td right className="fig">{money(acc.openingBalance)}</Td>
              </tr>
              {(acc.lines || []).map((l: any, i: number) => (
                <tr key={i}>
                  <Td className="mono">{l.voucherNo}</Td>
                  <Td>{fmtDate(l.voucherDate)}</Td>
                  <Td className="max-w-[220px] truncate">{l.narration || "—"}</Td>
                  <Td right>{l.debit ? <Money v={l.debit} /> : "—"}</Td>
                  <Td right>{l.credit ? <Money v={l.credit} /> : "—"}</Td>
                  <Td right className="fig">{money(l.balance)}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      ))}
    </div>
  );
}

function DayBookView({ data }: { data: any }) {
  return (
    <Panel pad={false} title={`Day Book${data.fromDate ? ` · ${fmtDate(data.fromDate)} – ${fmtDate(data.toDate)}` : ""}`} right={<span className="fig text-sm">{money(data.total)}</span>}>
      <TableWrap>
        <thead>
          <tr>
            <Th>Voucher</Th>
            <Th>Type</Th>
            <Th>Date</Th>
            <Th>Narration</Th>
            <Th right>Amount</Th>
            <Th className="w-24">Status</Th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 && <EmptyRow colSpan={6} text="No vouchers in this period." />}
          {data.rows.map((r: any) => (
            <tr key={r.id}>
              <Td className="mono">{r.voucherNo}</Td>
              <Td>{r.voucherType}</Td>
              <Td>{fmtDate(r.voucherDate)}</Td>
              <Td className="max-w-[260px] truncate">{r.narration || "—"}</Td>
              <Td right><Money v={r.amount} /></Td>
              <Td>
                <Badge tone={r.status === "POSTED" ? "ok" : r.status === "DRAFT" ? "warn" : "bad"}>{r.status}</Badge>
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Panel>
  );
}

function exportReport(key: ReportKey, data: any, label: string) {
  if (!data) return;
  const file = `${label.toLowerCase().replace(/\s+/g, "-")}.csv`;
  if (key === "trial-balance") {
    downloadCSV(file, ["Ledger", "Group", "Debit", "Credit"], data.rows.map((r: any) => [r.ledger, r.group, r.debit, r.credit]));
  } else if (key === "profit-loss") {
    const rows = [
      ...data.expense.map((r: any) => ["Expense", r.ledger, r.amount]),
      ...data.income.map((r: any) => ["Income", r.ledger, r.amount]),
      [data.isProfit ? "Net Profit" : "Net Loss", "", data.netProfit],
    ];
    downloadCSV(file, ["Section", "Ledger", "Amount"], rows);
  } else if (key === "balance-sheet") {
    const rows = [
      ...data.liabilities.map((r: any) => ["Liabilities", r.ledger, r.amount]),
      ...data.assets.map((r: any) => ["Assets", r.ledger, r.amount]),
    ];
    downloadCSV(file, ["Section", "Ledger", "Amount"], rows);
  } else if (key === "day-book") {
    downloadCSV(file, ["Voucher", "Type", "Date", "Narration", "Amount", "Status"], data.rows.map((r: any) => [r.voucherNo, r.voucherType, r.voucherDate, r.narration, r.amount, r.status]));
  } else {
    const rows: any[] = [];
    (data.accounts || []).forEach((acc: any) => {
      rows.push([acc.ledger, "Opening", "", "", "", acc.openingBalance]);
      (acc.lines || []).forEach((l: any) => rows.push([acc.ledger, l.voucherNo, l.voucherDate, l.debit, l.credit, l.balance]));
    });
    downloadCSV(file, ["Account", "Voucher", "Date", "Debit", "Credit", "Balance"], rows);
  }
}
