"""Stdlib-only regression tests for document_extract_service (run: python test_document_extract.py)."""
import sys

from app.services.document_extract_service import _num, _to_iso, extract
from app.services.gst_service import GstService

PASS = 0
FAIL = 0


def check(name, cond, extra=""):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  ok: {name}")
    else:
        FAIL += 1
        print(f"  FAIL: {name} {extra}")


def base_text(**kw):
    return "\n".join([
        "TAX INVOICE",
        f"Invoice No: {kw.get('inv', 'INV-1001')}",
        f"Date: {kw.get('date', '12/08/2026')}",
        f"Seller ABC Traders GSTIN {kw.get('seller', '27AAPCS1234F1Z5')}",
        f"Buyer XYZ Stores GSTIN {kw.get('buyer', '29AAPCS1234F1Z5')}",
        kw.get("body", "Widget A HSN 8471 2 x 500 18%"),
        f"Taxable Value Rs {kw.get('taxable', '1000.00')}",
        f"CGST Rs {kw.get('cgst', '90.00')}",
        f"SGST Rs {kw.get('sgst', '90.00')}",
        f"Grand Total Rs {kw.get('grand', '1180.00')}",
    ])


print("== invoice_no ==")
r = extract({"full_text": base_text(), "tables": []}, target="SALES")
check("inv number", r["fields"]["invoice_no"] == "INV-1001", r["fields"]["invoice_no"])
check("doc_type sales", r["doc_type"] == "SALES_INVOICE", r["doc_type"])
r2 = extract({"full_text": base_text(), "tables": []}, target="PURCHASE")
check("doc_type purchase", r2["doc_type"] == "PURCHASE_BILL", r2["doc_type"])

print("== dates ==")
check("dd/mm/yyyy", _to_iso("12/08/2026") == "2026-08-12", _to_iso("12/08/2026"))
check("dd-mm-yy", _to_iso("05-09-26") == "2026-09-05", _to_iso("05-09-26"))
check("text month", _to_iso("12 Aug 2026") == "2026-08-12", _to_iso("12 Aug 2026"))
r = extract({"full_text": base_text(date="05 Sep 2026"), "tables": []})
check("text-month in doc", r["fields"]["invoice_date"] == "2026-09-05", r["fields"]["invoice_date"])

print("== indian numbers ==")
check("lakh format", _num("1,00,000.50") == 100000.5, _num("1,00,000.50"))
check("plain", _num("1180.00") == 1180.0)

print("== gstin roles / states ==")
r = extract({"full_text": base_text(), "tables": []})
check("seller first", r["fields"]["seller_gstin"] == "27AAPCS1234F1Z5", r["fields"]["seller_gstin"])
check("buyer second", r["fields"]["buyer_gstin"] == "29AAPCS1234F1Z5", r["fields"]["buyer_gstin"])
check("inter-state (27 vs 29)", r["fields"]["inter_state"] is True)
check("seller state", r["fields"]["seller_state"] == "Maharashtra", r["fields"]["seller_state"])
r = extract({"full_text": base_text(seller="27AAPCS1234F1Z5", buyer="27AAPCS1234F1Z5")})
check("intra-state same code", r["fields"]["inter_state"] is False)

print("== checksum ==")
v = GstService.validate_gstin("27AAPCS1234F1Z5")
print(f"  (sample GSTIN valid={v['valid']} — synthetic numbers may warn, real ones pass)")
r = extract({"full_text": base_text(seller="27XXXXX0000X1Z5"), "tables": []})
check("bad gstin not trusted as seller", r["fields"]["seller_gstin"] != "27XXXXX0000X1Z5"
      or any("checksum" in w for w in r["warnings"]),
      str(r["fields"]["seller_gstin"]))

print("== totals cross-check ==")
r = extract({"full_text": base_text(), "tables": []})
check("reconciled", r["totals_check"]["reconciled"] is True, r["totals_check"])
check("conf keys", set(r["confidence_breakdown"]) == {"invoice_no", "invoice_date", "gstin", "lines", "totals_reconcile", "tax_breakup"})
r = extract({"full_text": base_text(grand="9999.00"), "tables": []})
check("mismatch warns", any("differs" in w for w in r["warnings"]), r["warnings"])
check("mismatch not reconciled", r["totals_check"]["reconciled"] is False)

print("== round-off ==")
r = extract({"full_text": base_text(grand="1181.00"), "tables": []})
check("round-off absorbed", r["totals_check"]["reconciled"] is True and r["fields"]["round_off"] == 1.0,
      f"{r['totals_check']} ro={r['fields']['round_off']}")

print("== table lines (multi-rate + discount) ==")
tables = [{"rows": [
    ["Description", "HSN", "Qty", "Rate", "Discount", "GST%"],
    ["Widget A", "8471", "2", "500", "100", "18"],
    ["Service B", "9983", "1", "1000", "", "12"],
    ["Grand Total", "", "", "", "", ""],
]}]
r = extract({"full_text": "TAX INVOICE GSTIN", "tables": tables})
check("2 lines (totals row skipped)", len(r["lines"]) == 2, r["lines"])
check("discount parsed", r["lines"][0]["discount"] == 100.0, r["lines"][0])
check("line amount", r["lines"][0]["amount"] == 900.0, r["lines"][0])
check("multi-rate", r["lines"][1]["gst_rate"] == 12.0, r["lines"][1])
check("computed taxable", r["totals_check"]["computed_taxable"] == 1900.0, r["totals_check"])

print("== split cgst/sgst columns ==")
tables = [{"rows": [
    ["Particulars", "Qty", "Price", "CGST%", "SGST%"],
    ["Item X", "5", "200", "9", "9"],
]}]
r = extract({"full_text": "TAX INVOICE", "tables": tables})
check("cgst+sgst rate", r["lines"] and r["lines"][0]["gst_rate"] == 18.0, r["lines"])

print("== empty doc ==")
r = extract({"full_text": "hello world", "tables": []})
check("unknown type", r["doc_type"] == "UNKNOWN")
check("low confidence", r["confidence"] < 40, r["confidence"])
check("warnings present", len(r["warnings"]) >= 3, r["warnings"])

print("== qty with units + per column ==")
tables = [{"rows": [
    ["Description", "HSN", "Quantity", "Rate", "per", "Amount"],
    ["Steel Pipes 25mm", "7306", "100 Nos", "550", "Nos", "55000"],
    ["GI Sheets 0.5mm", "7210", "20 Sheets", "780", "Sheets", "15600"],
]}]
r = extract({"full_text": "TAX INVOICE", "tables": tables})
check("qty 100", r["lines"] and r["lines"][0]["qty"] == 100.0, r["lines"])
check("unit Nos", r["lines"] and r["lines"][0]["unit"] == "Nos", r["lines"])
check("unit Sheets", r["lines"] and r["lines"][1]["unit"] == "Sheets", r["lines"])
check("taxable 70600", r["totals_check"]["computed_taxable"] == 70600.0, r["totals_check"])

print("== printed grandTotal variants ==")
r = extract({"full_text": "Sub Total 1,01,600.00\nTotal Invoice Amount Rs 1,19,888.00", "tables": []})
check("total invoice amount", r["fields"]["grand_total"] == 119888.0, r["fields"]["grand_total"])
r = extract({"full_text": "Sub Total | 1,01,600.00", "tables": []})
check("pipe-separated subtotal", r["fields"]["taxable"] == 101600.0, r["fields"]["taxable"])
r = extract({"full_text": "CGST @ 9%\nSGST @ 9%", "tables": []})
check("@ rate not an amount", r["fields"]["cgst"] in (0, None) and r["fields"]["sgst"] in (0, None),
      f"{r['fields']['cgst']},{r['fields']['sgst']}")

print("== hyphenated textual date ==")
check("15-May-2025", _to_iso("15-May-2025") == "2025-05-15", _to_iso("15-May-2025"))
r = extract({"full_text": "SALES INVOICE\nDated\n15-May-2025", "tables": []})
check("dated label + hyphen date", r["fields"]["invoice_date"] == "2025-05-15", r["fields"]["invoice_date"])

print("== hsn tax summary table ==")
tables = [{"rows": [
    ["HSN/SAC", "Taxable Value", "CGST Rate", "CGST Amount", "SGST Rate", "SGST Amount"],
    ["7306", "55,000.00", "9%", "4,950.00", "9%", "4,950.00"],
    ["7216", "31,000.00", "9%", "2,790.00", "9%", "2,790.00"],
    ["Total", "86,000.00", "", "7,740.00", "", "7,740.00"],
]}]
r = extract({"full_text": "TAX INVOICE", "tables": tables})
check("summary cgst total-row", r["fields"]["cgst"] == 7740.0, r["fields"]["cgst"])
check("summary sgst total-row", r["fields"]["sgst"] == 7740.0, r["fields"]["sgst"])
check("summary taxable", r["fields"]["taxable"] == 86000.0, r["fields"]["taxable"])

print("== doc split vs gstin conflict ==")
txt = base_text(seller="27AAPCS1234F1Z5", buyer="29AAPCS1234F1Z5",
                cgst="9144.00", sgst="9144.00", taxable="101600.00", grand="119888.00",
                body="Item X 2 x 100 18%")
r = extract({"full_text": txt, "tables": []})
check("doc cgst kept (not igst)", r["fields"]["cgst"] == 9144.0 and r["fields"]["igst"] == 0,
      f"{r['fields']['cgst']},{r['fields']['igst']}")
check("conflict warned", any("CGST+SGST" in w for w in r["warnings"]), r["warnings"])

print(f"\n{PASS} passed, {FAIL} failed")
sys.exit(1 if FAIL else 0)
