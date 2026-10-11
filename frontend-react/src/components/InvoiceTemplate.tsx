import React from "react";
import { Download, Printer } from "lucide-react";
import { money, fmtDate, amountInWords } from "../lib/format";
import { partyName } from "../lib/vouchers";

interface InvoiceTemplateProps {
  voucher: any;
  kind: "SALES" | "PURCHASE";
  company: any;
  parties: any[];
  ledgers: any[];
  items?: any[];
  bankAccounts?: any[];
}

export function InvoiceTemplate({
  voucher,
  kind,
  company,
  parties,
  ledgers,
  items = [],
  bankAccounts = [],
}: InvoiceTemplateProps) {
  const isSales = kind === "SALES";
  const title = isSales ? "SALES INVOICE" : "PURCHASE INVOICE";
  const copyType = isSales ? "Original for Recipient" : "Original for Supplier";

  // Identify party ledger line
  const partyLine = (voucher?.details || []).find((d: any) =>
    isSales
      ? (d.debitAmount || 0) > 0 && (d.ledgerName || "").toLowerCase() !== "round off"
      : (d.creditAmount || 0) > 0 && (d.ledgerName || "").toLowerCase() !== "round off"
  );

  const matchedParty = parties.find(
    (p) => p.ledger_id && partyLine?.ledgerId && String(p.ledger_id) === String(partyLine.ledgerId)
  );

  const partyDisplayName = matchedParty
    ? partyName(matchedParty)
    : partyLine?.ledgerName || ledgers.find((l) => l.id === partyLine?.ledgerId)?.name || (isSales ? "Customer" : "Supplier");

  const partyAddress = matchedParty?.address_info?.billing_address || {};
  const partyGstin = matchedParty?.gstin || "—";
  const partyState = partyAddress.state || company?.state || "Tamil Nadu";
  const partyStateCode = partyAddress.state_code || company?.state_code || "33";

  // Identify Tax & Revenue lines from voucher details
  const revenueLine = (voucher?.details || []).find((d: any) =>
    (d.ledgerName || "").toLowerCase().includes("sales") || (d.ledgerName || "").toLowerCase().includes("purchase")
  );
  const cgstLine = (voucher?.details || []).find((d: any) => (d.ledgerName || "").toLowerCase().includes("cgst"));
  const sgstLine = (voucher?.details || []).find((d: any) => (d.ledgerName || "").toLowerCase().includes("sgst"));
  const igstLine = (voucher?.details || []).find((d: any) => (d.ledgerName || "").toLowerCase().includes("igst"));
  const roundOffLine = (voucher?.details || []).find((d: any) => (d.ledgerName || "").toLowerCase().includes("round off"));

  const grandTotal = Number(voucher?.totalDebit || voucher?.totalCredit || 0);
  const cgstAmount = Number(isSales ? cgstLine?.creditAmount : cgstLine?.debitAmount) || 0;
  const sgstAmount = Number(isSales ? sgstLine?.creditAmount : sgstLine?.debitAmount) || 0;
  const igstAmount = Number(isSales ? igstLine?.creditAmount : igstLine?.debitAmount) || 0;
  const totalTax = cgstAmount + sgstAmount + igstAmount;
  const taxableSubTotal =
    Number(isSales ? revenueLine?.creditAmount : revenueLine?.debitAmount) ||
    Math.max(0, grandTotal - totalTax);
  const roundOff =
    Number(roundOffLine?.debitAmount ? -roundOffLine.debitAmount : roundOffLine?.creditAmount || 0);

  // Bank account info
  const primaryBank = bankAccounts.find((b: any) => b.active === "Y" && b.account_type !== "CASH") || bankAccounts[0] || {};

  // Build items from narration or line breakdown
  const itemNames = (voucher?.narration || "Standard Supply of Goods / Services")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  const lineRows = itemNames.map((name: string, idx: number) => {
    const share = taxableSubTotal / (itemNames.length || 1);
    return {
      slNo: idx + 1,
      description: name || "Commercial Goods",
      hsn: "8471",
      qty: 1,
      unit: "Nos",
      rate: share,
      amount: share,
    };
  });

  const handlePrint = () => {
    const printContent = document.getElementById("invoice-printable-area");
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${voucher?.voucherNo || "Invoice"}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .invoice-box {
              width: 100%;
              border: 1.5px solid #1e293b;
              box-sizing: border-box;
              font-size: 11px;
              line-height: 1.35;
            }
            .border-b { border-bottom: 1px solid #1e293b; }
            .border-r { border-right: 1px solid #1e293b; }
            .border-l { border-left: 1px solid #1e293b; }
            .border-t { border-top: 1px solid #1e293b; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 4px 6px; box-sizing: border-box; }
            .table-header th {
              background-color: #3b0764 !important;
              color: #ffffff !important;
              font-weight: 600;
              text-align: left;
              border-right: 1px solid #ffffff;
            }
            .table-header th:last-child { border-right: none; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .text-purple { color: #581c87; }
            .text-blue { color: #1e3a8a; }
            .uppercase { text-transform: uppercase; }
            .p-2 { padding: 6px 8px; }
            .p-1 { padding: 3px 6px; }
            .bg-gray { background-color: #f8fafc; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    win.document.close();
  };

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-muted/40 p-3 rounded-lg border border-border">
        <div className="text-xs text-muted-foreground">
          Official GST Tax Invoice Preview &bull; Click <strong>Download / Print</strong> to save as PDF or print.
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" />
            Download / Print PDF
          </button>
        </div>
      </div>

      {/* Invoice Container */}
      <div
        id="invoice-printable-area"
        className="bg-white text-slate-900 border-2 border-slate-800 rounded shadow-md overflow-hidden text-[11px] leading-tight"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Title Header */}
        <div className="relative py-2.5 px-4 text-center border-b border-slate-800 bg-white">
          <h2 className="text-base font-extrabold tracking-wider uppercase text-slate-900">{title}</h2>
          <span className="absolute right-3 top-3 text-[10px] font-semibold text-blue-700">
            {copyType}
          </span>
        </div>

        {/* Top Company & Invoice Metadata Section */}
        <div className="grid grid-cols-2 border-b border-slate-800">
          {/* Seller / Primary Party Box */}
          <div className="p-3 border-r border-slate-800 space-y-1 bg-white">
            <div className="font-bold text-[13px] text-blue-900 tracking-tight">
              {isSales ? (company?.company_name || "IMMBIZ BOOKS") : partyDisplayName}
            </div>
            <div className="text-slate-600 text-[11px]">
              {isSales
                ? `${company?.address || "12, Commercial Road"}, ${company?.city || "Chennai"} - ${company?.pincode || "600002"}`
                : `${partyAddress.address_line1 || "Industrial Estate"}, ${partyAddress.city || "Chennai"}`}
            </div>
            <div className="text-slate-600 text-[11px]">
              {isSales ? (company?.state || "Tamil Nadu, India") : `${partyState}, India`}
            </div>
            <div className="pt-1 text-[11px]">
              <span className="font-semibold text-slate-700">GSTIN/UIN: </span>
              <span className="font-mono font-medium">{isSales ? (company?.gstin || "33AABCA1234B1Z5") : partyGstin}</span>
            </div>
            <div className="text-[11px]">
              <span className="font-semibold text-slate-700">State Name : </span>
              <span>{isSales ? (company?.state || "Tamil Nadu") : partyState}, </span>
              <span className="font-semibold text-slate-700">Code : </span>
              <span className="font-mono">{isSales ? (company?.state_code || "33") : partyStateCode}</span>
            </div>
            <div className="text-slate-600 text-[10.5px] pt-0.5">
              <span>E-Mail : {isSales ? (company?.email || "accounts@immbiz.in") : (matchedParty?.name_contact_info?.email || "contact@supplier.in")}</span>
              <span className="ml-2">Phone : {isSales ? (company?.mobile || "044-4001 4000") : (matchedParty?.name_contact_info?.mobile || "—")}</span>
            </div>
          </div>

          {/* Invoice Meta Key-Values Grid */}
          <div className="grid grid-cols-2 text-[10.5px]">
            <div className="p-1.5 border-r border-b border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Invoice No.</div>
              <div className="font-bold font-mono text-slate-900">{voucher?.voucherNo || "INV-001"}</div>
            </div>
            <div className="p-1.5 border-b border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Dated</div>
              <div className="font-semibold text-slate-900">{fmtDate(voucher?.voucherDate)}</div>
            </div>

            <div className="p-1.5 border-r border-b border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Delivery Note</div>
              <div className="font-mono text-slate-700">{voucher?.referenceNo ? `DN/${voucher.referenceNo}` : "—"}</div>
            </div>
            <div className="p-1.5 border-b border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Mode/Terms of Payment</div>
              <div className="font-medium text-slate-700">Due on Receipt / 30 Days</div>
            </div>

            <div className="p-1.5 border-r border-b border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Reference No. &amp; Date</div>
              <div className="font-mono text-slate-700">{voucher?.referenceNo || "—"}</div>
            </div>
            <div className="p-1.5 border-b border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Other References</div>
              <div className="text-slate-700">—</div>
            </div>

            <div className="p-1.5 border-r border-slate-800">
              <div className="text-slate-500 text-[9.5px]">Dispatched through</div>
              <div className="text-slate-700">By Road / Logistics</div>
            </div>
            <div className="p-1.5">
              <div className="text-slate-500 text-[9.5px]">Destination</div>
              <div className="text-slate-700">{isSales ? partyState : (company?.state || "Tamil Nadu")}</div>
            </div>
          </div>
        </div>

        {/* Bill To Customer / Buyer Section */}
        <div className="p-3 border-b border-slate-800 bg-slate-50/50">
          <div className="font-bold text-[10px] text-slate-500 uppercase tracking-wider mb-1">
            BILL TO :
          </div>
          <div className="font-bold text-[13px] text-purple-950">
            {isSales ? partyDisplayName : (company?.company_name || "IMMBIZ BOOKS")}
          </div>
          <div className="text-slate-700 text-[11px]">
            {isSales
              ? `${partyAddress.address_line1 || "Industrial Estate"}, ${partyAddress.city || "Bangalore"} - ${partyAddress.pincode || "560058"}`
              : `${company?.address || "12, Park Street"}, ${company?.city || "Chennai"} - ${company?.pincode || "600002"}`}
          </div>
          <div className="text-slate-700 text-[11px]">
            {isSales ? `${partyState}, India` : `${company?.state || "Tamil Nadu"}, India`}
          </div>
          <div className="pt-1 flex flex-wrap gap-4 text-[11px]">
            <div>
              <span className="font-semibold text-slate-700">GSTIN/UIN: </span>
              <span className="font-mono font-medium">{isSales ? partyGstin : (company?.gstin || "33AABCA1234B1Z5")}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-700">State Name: </span>
              <span>{isSales ? partyState : (company?.state || "Tamil Nadu")}, </span>
              <span className="font-semibold text-slate-700">Code: </span>
              <span className="font-mono">{isSales ? partyStateCode : (company?.state_code || "33")}</span>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <table className="w-full text-[11px] border-b border-slate-800">
          <thead>
            <tr className="bg-purple-950 text-white font-semibold text-[10.5px]">
              <th className="py-1.5 px-2 text-center w-10 border-r border-purple-800">Sl No</th>
              <th className="py-1.5 px-2 text-left border-r border-purple-800">Description of Goods</th>
              <th className="py-1.5 px-2 text-center w-20 border-r border-purple-800">HSN/SAC</th>
              <th className="py-1.5 px-2 text-right w-20 border-r border-purple-800">Quantity</th>
              <th className="py-1.5 px-2 text-right w-24 border-r border-purple-800">Rate (₹)</th>
              <th className="py-1.5 px-2 text-center w-14 border-r border-purple-800">per</th>
              <th className="py-1.5 px-2 text-right w-28">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {lineRows.map((row: any, idx: number) => (
              <tr key={idx} className="border-b border-slate-200">
                <td className="py-2 px-2 text-center text-slate-500 font-mono border-r border-slate-800">{row.slNo}</td>
                <td className="py-2 px-2 font-medium text-slate-900 border-r border-slate-800">{row.description}</td>
                <td className="py-2 px-2 text-center font-mono text-slate-700 border-r border-slate-800">{row.hsn}</td>
                <td className="py-2 px-2 text-right font-mono text-slate-800 border-r border-slate-800">{row.qty} {row.unit}</td>
                <td className="py-2 px-2 text-right font-mono text-slate-800 border-r border-slate-800">{money(row.rate).replace("₹", "")}</td>
                <td className="py-2 px-2 text-center text-slate-600 border-r border-slate-800">{row.unit}</td>
                <td className="py-2 px-2 text-right font-mono font-semibold text-slate-900">{money(row.amount).replace("₹", "")}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-50 font-bold border-t border-slate-800">
              <td colSpan={3} className="py-1.5 px-3 text-right uppercase tracking-wider text-slate-700 border-r border-slate-800">
                Total
              </td>
              <td className="py-1.5 px-2 text-right font-mono border-r border-slate-800">
                {lineRows.reduce((s: number, r: any) => s + r.qty, 0)} Nos
              </td>
              <td colSpan={2} className="border-r border-slate-800" />
              <td className="py-1.5 px-2 text-right font-mono text-slate-900">
                {money(taxableSubTotal).replace("₹", "")}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Chargeable in Words + Tax Totals Grid */}
        <div className="grid grid-cols-12 border-b border-slate-800">
          <div className="col-span-7 p-3 border-r border-slate-800 flex flex-col justify-between bg-white">
            <div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Amount Chargeable (in words)</div>
              <div className="font-bold text-slate-900 mt-1 text-[11.5px]">
                {amountInWords(grandTotal)}
              </div>
            </div>
          </div>

          <div className="col-span-5 text-[11px] bg-slate-50/70">
            <table className="w-full">
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="p-1.5 text-slate-700 font-medium">Sub Total</td>
                  <td className="p-1.5 text-right font-mono font-semibold text-slate-900">{money(taxableSubTotal).replace("₹", "")}</td>
                </tr>
                {cgstAmount > 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="p-1.5 text-slate-700">CGST @ 9%</td>
                    <td className="p-1.5 text-right font-mono text-slate-900">{money(cgstAmount).replace("₹", "")}</td>
                  </tr>
                )}
                {sgstAmount > 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="p-1.5 text-slate-700">SGST @ 9%</td>
                    <td className="p-1.5 text-right font-mono text-slate-900">{money(sgstAmount).replace("₹", "")}</td>
                  </tr>
                )}
                {igstAmount > 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="p-1.5 text-slate-700">IGST @ 18%</td>
                    <td className="p-1.5 text-right font-mono text-slate-900">{money(igstAmount).replace("₹", "")}</td>
                  </tr>
                )}
                {roundOff !== 0 && (
                  <tr className="border-b border-slate-200">
                    <td className="p-1.5 text-slate-700">Rounded Off</td>
                    <td className="p-1.5 text-right font-mono text-slate-900">{money(roundOff).replace("₹", "")}</td>
                  </tr>
                )}
                <tr className="bg-slate-200/60 font-bold border-t border-slate-800">
                  <td className="p-2 text-slate-900 uppercase">Total Invoice Amount</td>
                  <td className="p-2 text-right font-mono text-blue-900 text-[12px]">{money(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* HSN/SAC Tax Summary Table */}
        <div className="border-b border-slate-800">
          <table className="w-full text-[10.5px]">
            <thead>
              <tr className="bg-slate-100 font-semibold border-b border-slate-800 text-slate-700">
                <th className="py-1 px-2 text-left border-r border-slate-800">HSN/SAC</th>
                <th className="py-1 px-2 text-right border-r border-slate-800">Taxable Value</th>
                {cgstAmount > 0 && (
                  <>
                    <th className="py-1 px-2 text-center border-r border-slate-800">CGST Rate</th>
                    <th className="py-1 px-2 text-right border-r border-slate-800">CGST Amount</th>
                  </>
                )}
                {sgstAmount > 0 && (
                  <>
                    <th className="py-1 px-2 text-center border-r border-slate-800">SGST Rate</th>
                    <th className="py-1 px-2 text-right border-r border-slate-800">SGST Amount</th>
                  </>
                )}
                {igstAmount > 0 && (
                  <>
                    <th className="py-1 px-2 text-center border-r border-slate-800">IGST Rate</th>
                    <th className="py-1 px-2 text-right border-r border-slate-800">IGST Amount</th>
                  </>
                )}
                <th className="py-1 px-2 text-right">Total Tax Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-200">
                <td className="py-1 px-2 font-mono border-r border-slate-800">8471</td>
                <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(taxableSubTotal).replace("₹", "")}</td>
                {cgstAmount > 0 && (
                  <>
                    <td className="py-1 px-2 text-center font-mono border-r border-slate-800">9%</td>
                    <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(cgstAmount).replace("₹", "")}</td>
                  </>
                )}
                {sgstAmount > 0 && (
                  <>
                    <td className="py-1 px-2 text-center font-mono border-r border-slate-800">9%</td>
                    <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(sgstAmount).replace("₹", "")}</td>
                  </>
                )}
                {igstAmount > 0 && (
                  <>
                    <td className="py-1 px-2 text-center font-mono border-r border-slate-800">18%</td>
                    <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(igstAmount).replace("₹", "")}</td>
                  </>
                )}
                <td className="py-1 px-2 text-right font-mono font-semibold">{money(totalTax).replace("₹", "")}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-bold border-t border-slate-800">
                <td className="py-1 px-2 uppercase border-r border-slate-800">Total</td>
                <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(taxableSubTotal).replace("₹", "")}</td>
                {cgstAmount > 0 && (
                  <>
                    <td className="py-1 px-2 border-r border-slate-800" />
                    <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(cgstAmount).replace("₹", "")}</td>
                  </>
                )}
                {sgstAmount > 0 && (
                  <>
                    <td className="py-1 px-2 border-r border-slate-800" />
                    <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(sgstAmount).replace("₹", "")}</td>
                  </>
                )}
                {igstAmount > 0 && (
                  <>
                    <td className="py-1 px-2 border-r border-slate-800" />
                    <td className="py-1 px-2 text-right font-mono border-r border-slate-800">{money(igstAmount).replace("₹", "")}</td>
                  </>
                )}
                <td className="py-1 px-2 text-right font-mono text-slate-900">{money(totalTax).replace("₹", "")}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bank Details & Authorised Signatory Section */}
        <div className="grid grid-cols-2">
          <div className="p-3 border-r border-slate-800 space-y-1 bg-white">
            <div className="font-bold text-[11px] text-blue-900 underline mb-1">Bank Details :</div>
            <div className="grid grid-cols-3 gap-1 text-[10.5px]">
              <span className="font-semibold text-slate-700">Bank Name</span>
              <span className="col-span-2">: {primaryBank?.bank_name || "HDFC Bank"}</span>
              <span className="font-semibold text-slate-700">A/c No.</span>
              <span className="col-span-2 font-mono">: {primaryBank?.account_number || "50200012345678"}</span>
              <span className="font-semibold text-slate-700">IFSC Code</span>
              <span className="col-span-2 font-mono">: {primaryBank?.ifsc_code || "HDFC0001234"}</span>
              <span className="font-semibold text-slate-700">Branch</span>
              <span className="col-span-2">: {primaryBank?.branch || (company?.city || "Chennai")}</span>
            </div>
          </div>

          <div className="p-3 flex flex-col justify-between text-right bg-white">
            <div className="font-bold text-[11px] text-slate-800">
              For {isSales ? (company?.company_name || "IMMBIZ BOOKS") : partyDisplayName}
            </div>
            <div className="pt-8 space-y-1">
              <div className="font-cursive italic text-base text-slate-700 font-serif pr-4">
                {isSales ? (company?.company_name?.split(" ")[0] || "Authorized") : "Authorized"}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold uppercase pr-2">
                Authorised Signatory
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="py-1 px-4 text-center border-t border-slate-800 bg-slate-50 text-[9.5px] text-slate-500">
          This is a Computer Generated Invoice
        </div>
      </div>
    </div>
  );
}
