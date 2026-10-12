import { NavLink } from "react-router-dom";
import { useState } from "react";
import {
  Banknote,
  BookMarked,
  BookOpen,
  Building2,
  GitBranch,
  LayoutGrid,
  List,
  Percent,
  PieChart,
  Ruler,
  ScrollText,
  SlidersHorizontal,
  ShieldCheck,
  Tag,
  Truck,
  Users,
  UserRound,
  Puzzle,
  HelpCircle,
  ChevronsLeft,
  ChevronsRight,
  Wallet,
  ArrowDownCircle,
  ShoppingCart,
  ArrowLeftRight,
  Scale,
  CreditCard,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useCompany } from "../auth/CompanyContext";
import { cn } from "../lib/format";

interface Item {
  to: string;
  label: string;
  icon: any;
  perm?: string;
  maintainMode?: "ACCOUNT_ONLY" | "ACCOUNT_WITH_INVENTORY";
}
interface Group {
  module: string | null;
  items: Item[];
}

const NAV: Group[] = [
  { module: null, items: [{ to: "/app/dashboard", label: "Masters Dashboard", icon: LayoutGrid }] },
  {
    module: "Company",
    items: [{ to: "/app/companies", label: "Company Master", icon: Building2, perm: "COMPANY" }],
  },
  {
    module: "Chart of Accounts",
    items: [
      { to: "/app/ledgers", label: "Ledgers", icon: BookOpen, perm: "LEDGER" },
      { to: "/app/ledger-groups", label: "Ledger Groups", icon: GitBranch, perm: "LEDGER_GROUP" },
      { to: "/app/banks", label: "Bank & Cash", icon: Banknote, perm: "BANK_CASH" },
    ],
  },
  {
    module: "Sales & Purchases",
    items: [
      { to: "/app/customers", label: "Customers", icon: Users, perm: "CUSTOMER" },
      { to: "/app/vendors", label: "Vendors", icon: Truck, perm: "VENDOR" },
      { to: "/app/products", label: "Products", icon: Tag, perm: "ITEMS", maintainMode: "ACCOUNT_WITH_INVENTORY" },
      { to: "/app/units", label: "Units", icon: Ruler, perm: "UNITS", maintainMode: "ACCOUNT_WITH_INVENTORY" },
    ],
  },
  {
    module: "Tax & Dimensions",
    items: [
      { to: "/app/gst", label: "GST Setup", icon: Percent, perm: "GST_SETUP" },
      { to: "/app/cost-centers", label: "Cost Centers", icon: PieChart, perm: "COST_CENTER" },
    ],
  },
  {
    module: "Vouchers",
    items: [
      { to: "/app/accounting-vouchers", label: "Accounting Voucher", icon: ScrollText, perm: "VOUCHER", maintainMode: "ACCOUNT_ONLY" },
      { to: "/app/voucher-types", label: "Voucher Types", icon: ScrollText, perm: "VOUCHER_TYPE" },
      { to: "/app/sales", label: "Sales", icon: ShoppingCart, perm: "VOUCHER", maintainMode: "ACCOUNT_WITH_INVENTORY" },
      { to: "/app/purchase", label: "Purchase", icon: Truck, perm: "VOUCHER", maintainMode: "ACCOUNT_WITH_INVENTORY" },
      { to: "/app/receipt", label: "Receipt", icon: ArrowDownCircle, perm: "VOUCHER", maintainMode: "ACCOUNT_WITH_INVENTORY" },
      { to: "/app/payment", label: "Payment", icon: Wallet, perm: "VOUCHER", maintainMode: "ACCOUNT_WITH_INVENTORY" },
      { to: "/app/journal", label: "Journal", icon: ScrollText, perm: "VOUCHER", maintainMode: "ACCOUNT_WITH_INVENTORY" },
      { to: "/app/contra", label: "Contra", icon: ArrowLeftRight, perm: "VOUCHER", maintainMode: "ACCOUNT_WITH_INVENTORY" },
    ],
  },
  {
    module: "Reports",
    items: [{ to: "/app/reports", label: "Financial Reports", icon: Scale, perm: "VOUCHER" }],
  },
  {
    module: "Administration",
    items: [
      { to: "/app/users", label: "Users", icon: UserRound, perm: "USER_MASTER" },
      { to: "/app/roles", label: "Roles & Permissions", icon: ShieldCheck, perm: "USER_ROLE" },
      { to: "/app/settings", label: "System Settings", icon: SlidersHorizontal, perm: "SYSTEM_SETTING" },
      { to: "/app/subscription", label: "Subscription & Plans", icon: CreditCard },
      { to: "/app/lov", label: "List of Values", icon: List, perm: "LOV" },
      { to: "/app/custom-fields", label: "Custom Fields", icon: Puzzle, perm: "CUSTOM_FIELD" },
      { to: "/app/help", label: "Help & Updates", icon: HelpCircle },
    ],
  },
];

export function Sidebar() {
  const { can } = useAuth();
  const { company } = useCompany();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "shrink-0 h-screen sticky top-0 flex flex-col text-[#B9C1CC] transition-[width] duration-200",
        collapsed ? "w-[64px]" : "w-[64px] md:w-[236px]"
      )}
      style={{ background: "var(--ink)" }}
    >
      <div
        className={cn(
          "flex items-center gap-2.5 px-4 h-[60px] border-b border-white/[0.07]",
          collapsed ? "justify-center px-0" : "justify-center px-0 md:justify-start md:px-4"
        )}
      >
        <span
          className="h-8 w-8 rounded-md grid place-items-center shrink-0"
          style={{ background: "var(--teal)" }}
        >
          <BookMarked className="h-[18px] w-[18px] text-white" />
        </span>
        {!collapsed && (
          <div className="hidden md:block leading-tight">
            <div className="text-white font-semibold text-[15px] tracking-tight">ImmBiz Books</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[#7C8694]">CAAI Accounting</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((group, gi) => {
          const items = group.items.filter(
            (item) =>
              (!item.perm || can(item.perm, "view")) &&
              (!item.maintainMode || company?.maintain_mode === item.maintainMode)
          );
          if (items.length === 0) return null;
          return (
            <div key={gi} className="px-2.5 mb-1.5">
              {group.module && !collapsed && (
                <div className="hidden md:block px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#67707E]">
                  {group.module}
                </div>
              )}
              {group.module && (
                <div className={cn("mx-3 my-2 border-t border-white/[0.07] md:hidden", collapsed && "md:block")} />
              )}
              <ul className="space-y-0.5">
                {items.map((it) => (
                  <li key={it.to}>
                    <NavLink
                      to={it.to}
                      title={it.label}
                      className={({ isActive }) =>
                        cn(
                          "w-full flex items-center gap-2.5 rounded-[5px] py-[7px] text-[13px] transition-colors outline-none",
                          collapsed ? "justify-center px-0" : "justify-center px-0 md:justify-start md:px-2.5",
                          isActive
                            ? "bg-white/[0.1] text-white font-medium shadow-[inset_2px_0_0_0_var(--brass)]"
                            : "hover:bg-white/[0.05] hover:text-white"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <it.icon
                            className="h-4 w-4 shrink-0"
                            style={isActive ? { color: "var(--brass)" } : undefined}
                          />
                          {!collapsed && <span className="hidden md:inline truncate">{it.label}</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2.5 hidden md:flex items-center justify-center gap-2 rounded-[5px] py-2 text-xs text-[#8A93A1] hover:bg-white/[0.06] hover:text-white transition-colors"
      >
        {collapsed ? (
          <ChevronsRight className="h-4 w-4" />
        ) : (
          <>
            <ChevronsLeft className="h-4 w-4" />
            <span>Collapse</span>
          </>
        )}
      </button>
    </aside>
  );
}
