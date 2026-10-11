import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Suspense, lazy, type ReactNode } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { CompanyProvider } from "./auth/CompanyContext";
import { ToastProvider } from "./components/toast";
import { AppLayout } from "./components/AppLayout";

// Route-level code splitting keeps large accounting screens out of the first
// download. Each module is fetched only after the user navigates to it.
const Landing = lazy(() => import("./pages/Landing").then(({ Landing }) => ({ default: Landing })));
const Login = lazy(() => import("./pages/Login").then(({ Login }) => ({ default: Login })));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword").then(({ ForgotPassword }) => ({ default: ForgotPassword })));
const ChangePassword = lazy(() => import("./pages/ChangePassword").then(({ ChangePassword }) => ({ default: ChangePassword })));
const Dashboard = lazy(() => import("./pages/Dashboard").then(({ Dashboard }) => ({ default: Dashboard })));
const Ledgers = lazy(() => import("./pages/Ledgers").then(({ Ledgers }) => ({ default: Ledgers })));
const LedgerGroups = lazy(() => import("./pages/LedgerGroups").then(({ LedgerGroups }) => ({ default: LedgerGroups })));
const Products = lazy(() => import("./pages/Products").then(({ Products }) => ({ default: Products })));
const Parties = lazy(() => import("./pages/Parties").then(({ Parties }) => ({ default: Parties })));
const Lov = lazy(() => import("./pages/Lov").then(({ Lov }) => ({ default: Lov })));
const SystemSettings = lazy(() => import("./pages/SystemSettings").then(({ SystemSettings }) => ({ default: SystemSettings })));
const Roles = lazy(() => import("./pages/Roles").then(({ Roles }) => ({ default: Roles })));
const Users = lazy(() => import("./pages/Users").then(({ Users }) => ({ default: Users })));
const Journal = lazy(() => import("./pages/Journal").then(({ Journal }) => ({ default: Journal })));
const CashVoucher = lazy(() => import("./pages/CashVoucher").then(({ CashVoucher }) => ({ default: CashVoucher })));
const TradeVoucher = lazy(() => import("./pages/TradeVoucher").then(({ TradeVoucher }) => ({ default: TradeVoucher })));
const Contra = lazy(() => import("./pages/Contra").then(({ Contra }) => ({ default: Contra })));
const Reports = lazy(() => import("./pages/Reports").then(({ Reports }) => ({ default: Reports })));
const Companies = lazy(() => import("./pages/Companies").then(({ Companies }) => ({ default: Companies })));
const Banks = lazy(() => import("./pages/Banks").then(({ Banks }) => ({ default: Banks })));
const GstSetup = lazy(() => import("./pages/GstSetup").then(({ GstSetup }) => ({ default: GstSetup })));
const CostCenters = lazy(() => import("./pages/CostCenters").then(({ CostCenters }) => ({ default: CostCenters })));
const Units = lazy(() => import("./pages/Units").then(({ Units }) => ({ default: Units })));
const CustomFields = lazy(() => import("./pages/CustomFields").then(({ CustomFields }) => ({ default: CustomFields })));
const VoucherTypes = lazy(() => import("./pages/VoucherTypes").then(({ VoucherTypes }) => ({ default: VoucherTypes })));
const AccountingVouchers = lazy(() => import("./pages/AccountingVouchers").then(({ AccountingVouchers }) => ({ default: AccountingVouchers })));
const SubscriptionDashboard = lazy(() => import("./pages/SubscriptionDashboard"));
const LicenceManagement = lazy(() => import("./pages/LicenceManagement"));
const BackupManagement = lazy(() => import("./pages/BackupManagement"));
const AuditTrail = lazy(() => import("./pages/AuditTrail"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const loc = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: loc }} />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={
          isAuthenticated && !mustChangePassword ? <Navigate to="/app/dashboard" replace /> : <Login />
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route
        path="/change-password"
        element={isAuthenticated ? <ChangePassword /> : <Navigate to="/login" replace />}
      />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <CompanyProvider>
              <AppLayout />
            </CompanyProvider>
          </RequireAuth>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="companies" element={<Companies />} />
        <Route path="ledgers" element={<Ledgers />} />
        <Route path="ledger-groups" element={<LedgerGroups />} />
        <Route path="banks" element={<Banks />} />
        <Route path="customers" element={<Parties kind="C" />} />
        <Route path="vendors" element={<Parties kind="V" />} />
        <Route path="products" element={<Products />} />
        <Route path="units" element={<Units />} />
        <Route path="gst" element={<GstSetup />} />
        <Route path="cost-centers" element={<CostCenters />} />
        <Route path="voucher-types" element={<VoucherTypes />} />
        <Route path="accounting-vouchers" element={<AccountingVouchers />} />
        <Route path="journal" element={<Journal />} />
        <Route path="payment" element={<CashVoucher mode="PAYMENT" />} />
        <Route path="receipt" element={<CashVoucher mode="RECEIPT" />} />
        <Route path="sales" element={<TradeVoucher kind="SALES" />} />
        <Route path="purchase" element={<TradeVoucher kind="PURCHASE" />} />
        <Route path="contra" element={<Contra />} />
        <Route path="reports" element={<Reports />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="lov" element={<Lov />} />
        <Route path="custom-fields" element={<CustomFields />} />
        <Route path="subscription" element={<SubscriptionDashboard />} />
        <Route path="licences" element={<LicenceManagement />} />
        <Route path="backups" element={<BackupManagement />} />
        <Route path="audit" element={<AuditTrail />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Loading…</div>}>
            <AppRoutes />
          </Suspense>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
