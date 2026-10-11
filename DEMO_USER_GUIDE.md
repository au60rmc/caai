# ImmBiz Books — Comprehensive Demo User Guide Book
> **CAAI Enterprise Financial Accounting, Audit & Compliance Platform**  
> *Engineered for Chartered Accountants, Tax Auditors, CFOs, and Modern Enterprises*

---

## 📖 Welcome to ImmBiz Books

**ImmBiz Books** is an enterprise-grade cloud accounting platform combining the **lightning-fast keyboard workflows of Tally** with the **visual clarity, audit trails, and multi-entity governance of modern cloud ERPs (Zoho & SAP)**.

Built natively for Indian GST statutory laws and international financial accounting standards, ImmBiz Books offers end-to-end management of:
- **Multi-Company Accounting** (Account-Only & Inventory-enabled modes)
- **Hierarchical Chart of Accounts & Ledger Masters**
- **Customer & Vendor Directories with Instant GSTIN Validation**
- **Bank & Cash Management with Granular Account Balances**
- **Complete Invoicing & Voucher Lifecycles (Sales, Purchase, Receipt, Payment, Contra, Journal)**
- **GST Compliance (GSTR-1, GSTR-2B, GSTR-3B, ITC vs. Output Tax)**
- **Real-Time Financial Reports (Balance Sheet, Profit & Loss, Trial Balance, Day Book)**
- **Immutable Audit Trail & Health Checks**

---

## 🚀 Quick Access: Logging into the Demo Environment

You do **not** need a pre-configured password or an SMS OTP to test ImmBiz Books. The platform features an **instant, zero-barrier Public Demo Sandbox**.

### How to Access the Demo in 3 Steps:

1. **Navigate to the Login Page:**
   - Production / Staging URL: [https://audit-immbiz.vercel.app/login](https://audit-immbiz.vercel.app/login)
   - Local Development: `http://localhost:5173/login` (or `http://localhost:4300/login`)

2. **Enter Your Email:**
   - In the **Username or Email** field, type your business or personal email address (e.g., `demo.user@yourcompany.com`).

3. **Click "Try Public Demo":**
   - Click the **Try Public Demo** button located beneath the standard login form.
   - You will be automatically authenticated into an isolated sandbox session and redirected to the **Executive Dashboard** (`/app/dashboard`).

---

## 🛡️ The Demo Sandbox Architecture

To give you complete freedom to experiment, ImmBiz Books uses **Option 2 Schema-Isolated Sandboxing**:

- **Safe to Add, Edit, or Delete Data:** You can create new companies, issue test invoices, add bank accounts, edit ledgers, or delete test records.
- **Complete Isolation from Production Data:** All demo actions are dynamically routed to a dedicated PostgreSQL `demo` schema. Real company records in the `master` database schema remain 100% untouched and secure.
- **Realistic Pre-Seeded Business Data:** The demo comes pre-loaded with sample companies, standard Indian Chart of Accounts (HDFC Bank, ICICI Bank, Petty Cash, Sundry Debtors/Creditors, Sales, Purchases, GST taxes), and active vouchers so you can explore rich dashboards right away.

---

## 🧭 Step-by-Step Feature Walkthrough

---

### 1. Executive Financial Overview Dashboard (`/app/dashboard`)

The dashboard gives management and auditors an instant, birds-eye view of cash flow, receivables, payables, and profitability.

#### A. Bank Accounts Card (Granular Breakdown)
- **Total Bank Balance:** Big-figure display of aggregated funds across all connected banks.
- **Individual Account Details:** Lists each bank account individually:
  - Bank Name (e.g., *HDFC Bank Current A/C*, *ICICI Bank OD A/C*)
  - Account Number / Identifier
  - Exact Net Balance per bank
- **Reconciliation Status:** Indicates whether all transactions are reconciled or if entries are pending.
- **Quick Action:** Click **View Bank Accounts** or **+ New Bank** to configure banking records.

#### B. Cash in Hand Card
- Displays physical cash balances (*Cash Account*, *Petty Cash*).
- Allows quick navigation to cash registers and cash voucher entry screens.

#### C. Accounts Receivable (AR) & Receivables Ageing
- Total money owed by customers.
- **Aging buckets:** `Not Due`, `0–30 Days`, `31–60 Days`, `61–90 Days`, and high-risk `90+ Days`.
- Identifies customers missing valid GSTINs or exceeding credit limits.

#### D. Accounts Payable (AP) & Payables Ageing
- Total liabilities owed to suppliers and vendors.
- Categorized aging breakdown and invoice due date indicators.

#### E. Revenue, Operating Expenses & Net Profit
- Live calculation of Net Profit and Profit Margin %.
- **Comparison Filter:** Toggle between Budget Targets, Last Financial Year, or Previous Period.
- **Performance Trend:** 6-month interactive visual trend chart for revenue vs. expenses.

#### F. Books Health Status Banner
- Summarizes whether master accounts, audit closing checklists, and GST rate mappings are healthy (e.g., *94% complete*).

---

### 2. Managing Companies (`/app/companies`)

ImmBiz Books supports true multi-company and multi-branch accounting from a single portal.

#### Switching Active Companies:
- Click the **Company Selector** in the top navigation bar to switch between companies instantly. All screens, ledgers, vouchers, and reports immediately re-scope to the chosen company.

#### Creating a New Company:
1. Click **+ New Company**.
2. **Company Identification:** Enter Legal Name, Trade Name, CIN / Registration Number, PAN, and GSTIN.
3. **Books & Financial Year:** Set Financial Year Start (e.g., `01-04-2026`) and Books Beginning Date.
4. **Maintenance Mode:**
   - **Account Only:** Tailored for service companies, professionals, consulting firms, and CAs. Uses streamlined Accounting Vouchers and Voucher Types.
   - **Account with Inventory:** Designed for distributors, retailers, and manufacturers. Enables product catalogs, stock tracking, and trade vouchers (Sales/Purchase).
5. Click **Save Company**. Standard Chart of Accounts (groups and primary ledgers) are automatically pre-seeded for your new company!

---

### 3. Chart of Accounts & Ledgers (`/app/ledgers`)

The Chart of Accounts organizes every financial transaction in accordance with standard double-entry principles.

#### Ledger Structure:
- **Ledger Groups:** Hierarchical structure grouping accounts under **Assets**, **Liabilities**, **Incomes**, and **Expenses** (with sub-groups like *Current Assets*, *Sundry Debtors*, *Bank Accounts*, *Direct Expenses*).
- **Ledger Master:**
  - **Basic Info:** Ledger Name, Parent Group, Opening Balance (Dr/Cr).
  - **GST & Tax Classification:** Applicable GST rates, Reverse Charge Mechanism (RCM), Type of Supply (Goods vs Services).
  - **Contact & Banking:** Contact person, email, phone, bank account details.
- **Smart Features:**
  - **Auto-Suggest Group:** Typing "SBI" or "Customer" auto-recommends *Bank Accounts* or *Sundry Debtors*.
  - **Duplicate Validation:** Prevents duplicate accounts with real-time fuzzy search.
  - **Ledger Freeze & Lock:** Auditors can freeze individual ledgers or apply period locks (`BOOKS_LOCKED_UPTO`) to prevent backdated tampering.

---

### 4. Customers & Vendors Directory (`/app/parties`)

Manage all trade counterparties with integrated tax and credit intelligence.

#### Adding a New Party:
1. Navigate to **Parties** and select **+ New Customer** or **+ New Vendor**.
2. **Key Group:** Choose `Customer`, `Vendor`, or `Both` (for entities that both buy and sell).
3. **GSTIN Auto-Validation:** Enter the 15-digit Indian GSTIN. The system automatically validates:
   - State code prefix (e.g., `27` for Maharashtra, `29` for Karnataka, `33` for Tamil Nadu).
   - PAN extraction from characters 3 to 12.
   - Mod-36 checksum integrity.
4. **Credit Control:** Configure Credit Limit (in ₹) and Credit Period (in days).
5. **Auto-Ledger Linking:** When saved, the system automatically creates and links a dedicated ledger in the Chart of Accounts under *Sundry Debtors* or *Sundry Creditors*.
6. **Side Drawer Insights:** Click any party to inspect their open invoices, payment history, and current net balance without leaving the screen.

---

### 5. Banking & Cash Management (`/app/banks`)

Manage institutional bank accounts, cash registers, and reconciliation with ease.

#### Adding a Bank Account:
1. Click **+ New Bank**.
2. Provide Account Name, Bank Name, Account Number, IFSC code, and Branch.
3. Enter the Opening Balance as of your books opening date.
4. The system links the bank directly to your Chart of Accounts.

#### Bank Reconciliation:
- Match entries recorded in your books against your external bank statement.
- Mark verified dates to track **Reconciliation Status** (All reconciled vs. X entries pending).

---

### 6. Transactions & Vouchers (`/app/accounting-vouchers` or `/app/sales`, `/app/purchase`)

ImmBiz Books provides a powerful, flexible voucher entry system supporting both fast keyboard navigation and visual itemized invoicing.

#### Voucher Types Supported:
| Voucher Type | Purpose | Typical Debit / Credit |
|---|---|---|
| **Sales Voucher (Tax Invoice)** | Invoicing customers for goods or services | Dr Customer / Bank<br>Cr Sales Revenue, Cr Output CGST/SGST/IGST |
| **Purchase Voucher (Bill)** | Recording vendor bills and inventory purchases | Dr Purchase / Expenses, Dr Input Tax Credit<br>Cr Vendor / Bank |
| **Receipt Voucher** | Receiving payment from customers or other sources | Dr Bank / Cash<br>Cr Customer / Income |
| **Payment Voucher** | Paying suppliers, vendors, or operational expenses | Dr Vendor / Expense Account<br>Cr Bank / Cash |
| **Contra Voucher** | Cash deposits, withdrawals, or inter-bank fund transfers | Dr Target Bank/Cash<br>Cr Source Bank/Cash |
| **Journal Voucher** | Adjustments, depreciation, accruals, rectification | Dr Expense / Asset<br>Cr Liability / Asset |

#### Transaction Workflow:
1. **Header Details:** Date, Voucher Number (auto-incrementing or custom), Reference Number.
2. **Dynamic Entry Lines:**
   - Add multiple debit and credit rows.
   - For Sales/Purchase, select items with automatic tax calculation (CGST + SGST for Intra-State, IGST for Inter-State based on Place of Supply).
3. **Draft vs. Posted Lifecycle:**
   - **Save as Draft:** Save incomplete entries without affecting ledger balances or financial statements.
   - **Post Voucher:** Validates balanced debits and credits, then immutably updates ledger balances and the audit trail.
4. **Print / Export:** Export professional PDF tax invoices complete with company logos, GST breakdown, HSN summaries, and bank transfer details.

---

### 7. Products & Inventory (`/app/products` & `/app/units`)
*(Available in "Account with Inventory" mode)*

- **Product Master:** Create Goods and Services with unique SKU codes.
- **HSN / SAC Code Engine:** Search and assign proper HSN codes with pre-configured GST rates (0%, 5%, 12%, 18%, 28%).
- **Stock Tracking:** Monitor Opening Stock, Current Quantity, Minimum Reorder Level, and Unit of Measure (PCS, KGS, NOS, MTR, BOX).
- **Low Stock Alerts:** Get notified directly on the dashboard when items fall below their minimum threshold.

---

### 8. Financial Statements & Audit Reports (`/app/reports`)

Generate formal financial statements instantly in real time:

- **Balance Sheet:** Grouped by Liabilities (Capital, Reserves, Current Liabilities) and Assets (Fixed Assets, Current Assets, Bank & Cash).
- **Profit & Loss Statement (Income Statement):** Direct vs. Indirect Incomes and Expenses, Gross Profit, and Net Profit.
- **Trial Balance:** Complete ledger summary displaying opening balance, debit movements, credit movements, and closing balance to ensure books balance.
- **Day Book:** Chronological ledger log of all vouchers recorded on any chosen date.
- **GST Compliance Estimates:**
  - Summary of Output Tax collected on Sales.
  - Summary of Input Tax Credit (ITC) claimable from Purchases.
  - Net GST Payable or Carry-Forward Credit calculation.

---

## ⌨️ Power-User Keyboard Shortcuts

Speed is central to ImmBiz Books. Master these hotkeys to navigate the platform without touching the mouse:

| Hotkey | Action |
|---|---|
| `Ctrl + N` / `Cmd + N` | Open "New Record" creation drawer (Ledger, Party, Voucher) |
| `Ctrl + S` / `Cmd + S` | Save active form or post voucher |
| `Ctrl + K` / `Cmd + K` | Global search across all ledgers, parties, and vouchers |
| `Esc` | Close side drawer or modal |
| `Tab` / `Shift + Tab` | Move to next / previous input field |
| `Enter` | Select active dropdown option or submit line |

---

## ❓ Frequently Asked Questions (FAQ) for Demo Users

#### Q1: Will my changes in demo mode affect other people or real company data?
**No.** All demo actions are confined to the PostgreSQL `demo` schema. Production company accounts (`master` schema) are completely isolated and read-only to demo sessions.

#### Q2: Can I test adding a new company?
**Yes.** Go to **Companies** (`/app/companies`) and click **+ New Company**. You can create an Account-Only or Inventory-enabled company and test seeding default ledgers.

#### Q3: How do I test the Bank and Cash separation?
Go to the **Dashboard** (`/app/dashboard`). You will see two distinct cards:
- **Bank Accounts:** Shows total bank balance, individual accounts (e.g. HDFC Bank, ICICI Bank), account numbers, and reconciliation status.
- **Cash in Hand:** Shows physical cash balances and petty cash registers.

#### Q4: How do I test creating an invoice?
Go to **Accounting Vouchers** (or **Sales Invoices**), click **+ New**, pick a Customer and Sales Ledger, enter the line items, and click **Post**. Your Dashboard AR and Revenue metrics will immediately update in real time!

---

*ImmBiz Books — CAAI Financial Accounting, Audit & Compliance Platform.*
