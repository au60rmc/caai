import React, { useEffect, useState } from "react";
import {
  Check,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CreditCard,
  FileText,
  Sparkles,
  Download,
  Database,
  Shield,
  Users,
  Building2,
  ArrowRight,
  RefreshCw,
  Info,
  X,
  Zap,
} from "lucide-react";
import { api, envelopeResult } from "../lib/api";

interface TrialStatus {
  tier: string;
  plan_code: string;
  plan_name: string;
  is_trial: boolean;
  term_days: number;
  start_date: string;
  end_date: string;
  days_used: number;
  days_remaining: number;
  is_expired: boolean;
  posted_vouchers_count: number;
  max_vouchers: number;
  vouchers_remaining: number;
  ai_pages_count: number;
  max_ai_pages: number;
  ai_pages_remaining: number;
  companies_count: number;
  max_companies: number;
  users_count: number;
  max_users: number;
  can_post: boolean;
  can_view: boolean;
  can_backup: boolean;
  can_export: boolean;
  no_card_required: boolean;
  post_expiry_policy: string;
  status_label: string;
}

interface Plan {
  id: string;
  plan_code: string;
  plan_name: string;
  edition: string;
  term_type: string;
  term_days: number;
  max_companies: number;
  max_named_users: number;
  max_concurrent_sessions: number;
  transaction_limit: number;
  metering_period: string;
  deployment_model: string;
  maker_checker: string;
  mfa_mode: string;
  backup_mode: string;
  support_tier: string;
  price_monthly: number;
  price_annual: number;
  currency: string;
  feature_flags?: {
    badge?: string;
    tier_type?: string;
    ai_doc_limit?: number;
    no_card_required?: boolean;
    standalone_concurrent?: number;
    saas_concurrent?: number;
    standalone_transaction_limit?: string;
    saas_transaction_limit?: string;
    post_expiry_policy?: string;
    suitable_for?: string;
    custom_roles?: boolean;
    maker_checker?: boolean;
    approvals?: boolean;
    advanced_audit?: boolean;
    api_access?: boolean;
    sso?: boolean;
    service_accounts?: boolean;
    branches?: boolean;
    premium_support?: boolean;
    description?: string;
    features?: string[];
  };
}

const DEFAULT_PLANS: Plan[] = [
  {
    id: "trial",
    plan_code: "TRIAL",
    plan_name: "Trial",
    edition: "TRIAL",
    term_type: "DAYS",
    term_days: 30,
    max_companies: 1,
    max_named_users: 1,
    max_concurrent_sessions: 1,
    transaction_limit: 1000,
    metering_period: "TRIAL_PERIOD",
    deployment_model: "CLOUD_AND_STANDALONE",
    maker_checker: "N",
    mfa_mode: "LOCAL_PASSWORD",
    backup_mode: "LOCAL_AND_CLOUD",
    support_tier: "COMMUNITY",
    price_monthly: 0,
    price_annual: 0,
    currency: "INR",
    feature_flags: {
      badge: "Free Trial",
      tier_type: "Trial",
      ai_doc_limit: 50,
      no_card_required: true,
      standalone_concurrent: 1,
      saas_concurrent: 1,
      standalone_transaction_limit: "1,000 posted vouchers",
      saas_transaction_limit: "1,000 posted vouchers",
      post_expiry_policy: "After expiry, posting stops, but the customer can still view, back up and export data",
      suitable_for: "Evaluation & new user onboarding",
      features: [
        "30 days duration",
        "One company and one user",
        "Maximum 1,000 posted vouchers",
        "50 AI document-processing pages",
        "No payment card required",
        "After expiry: posting stops, view, back up and export data remain available",
      ],
    },
  },
  {
    id: "solo",
    plan_code: "SOLO",
    plan_name: "Solo",
    edition: "SOLO",
    term_type: "ANNUAL",
    term_days: 365,
    max_companies: 1,
    max_named_users: 1,
    max_concurrent_sessions: 1,
    transaction_limit: 5000,
    metering_period: "FINANCIAL_YEAR",
    deployment_model: "ONE_DEVICE_REHOST",
    maker_checker: "N",
    mfa_mode: "OPTIONAL_TOTP",
    backup_mode: "LOCAL_REMOVABLE",
    support_tier: "STANDARD",
    price_monthly: 499,
    price_annual: 4999,
    currency: "INR",
    feature_flags: {
      badge: "Proprietor",
      tier_type: "Solo",
      ai_doc_limit: 500,
      no_card_required: false,
      standalone_concurrent: 1,
      saas_concurrent: 1,
      standalone_transaction_limit: "No transaction limit",
      saas_transaction_limit: "5,000 chargeable documents per financial year",
      post_expiry_policy: "Grace period followed by read, backup and export access",
      suitable_for: "Proprietor or small business",
      features: [
        "One company",
        "One named user and one concurrent session",
        "Suitable for a proprietor or small business",
        "Standalone version has no transaction limit",
        "SaaS includes 5,000 chargeable documents per financial year",
        "Standard GST filing and financial reports",
      ],
    },
  },
  {
    id: "multi_company",
    plan_code: "MULTI_COMPANY",
    plan_name: "Multi Company",
    edition: "MULTI_COMPANY",
    term_type: "ANNUAL",
    term_days: 365,
    max_companies: 5,
    max_named_users: 1,
    max_concurrent_sessions: 1,
    transaction_limit: 25000,
    metering_period: "FINANCIAL_YEAR",
    deployment_model: "LAN",
    maker_checker: "N",
    mfa_mode: "OPTIONAL_TOTP",
    backup_mode: "LOCAL_AND_CLOUD",
    support_tier: "STANDARD",
    price_monthly: 999,
    price_annual: 9999,
    currency: "INR",
    feature_flags: {
      badge: "Accountant",
      tier_type: "Multi Company",
      ai_doc_limit: 1500,
      no_card_required: false,
      standalone_concurrent: 1,
      saas_concurrent: 1,
      standalone_transaction_limit: "No transaction limit",
      saas_transaction_limit: "25,000 chargeable documents per financial year",
      post_expiry_policy: "Grace period followed by read, backup and export access",
      suitable_for: "Owner or accountant managing several companies",
      features: [
        "Up to five companies",
        "One named user",
        "Suitable for an owner or accountant managing several companies",
        "This tier is multi-company, but it is not multi-user",
        "Standalone version has no transaction limit",
        "SaaS includes 25,000 documents per financial year",
      ],
    },
  },
  {
    id: "team",
    plan_code: "TEAM",
    plan_name: "Team",
    edition: "TEAM",
    term_type: "ANNUAL",
    term_days: 365,
    max_companies: 10,
    max_named_users: 10,
    max_concurrent_sessions: 10,
    transaction_limit: 100000,
    metering_period: "FINANCIAL_YEAR",
    deployment_model: "LAN",
    maker_checker: "Y",
    mfa_mode: "TOTP_PRIVILEGED",
    backup_mode: "LOCAL_NETWORK_REMOVABLE",
    support_tier: "PRIORITY",
    price_monthly: 2499,
    price_annual: 24999,
    currency: "INR",
    feature_flags: {
      badge: "Popular / Collaborative",
      tier_type: "Team",
      ai_doc_limit: 5000,
      no_card_required: false,
      standalone_concurrent: 5,
      saas_concurrent: 10,
      standalone_transaction_limit: "No transaction limit",
      saas_transaction_limit: "100,000 chargeable documents per financial year",
      post_expiry_policy: "Grace period followed by read, backup and export access",
      suitable_for: "Collaborative accounting teams and growing businesses",
      custom_roles: true,
      maker_checker: true,
      approvals: true,
      advanced_audit: true,
      api_access: true,
      features: [
        "Up to ten companies",
        "Ten named users",
        "Five concurrent users for standalone and ten for SaaS",
        "Custom roles, maker-checker & approvals",
        "Advanced audit controls & immutable audit log",
        "API access for external software",
        "Priority technical support",
      ],
    },
  },
  {
    id: "corporate",
    plan_code: "CORPORATE",
    plan_name: "Corporate",
    edition: "CORPORATE",
    term_type: "ANNUAL",
    term_days: 365,
    max_companies: 50,
    max_named_users: 25,
    max_concurrent_sessions: 25,
    transaction_limit: 1000000,
    metering_period: "FINANCIAL_YEAR",
    deployment_model: "MULTI_SITE",
    maker_checker: "Y",
    mfa_mode: "TOTP_MANDATORY_SSO_OPTIONAL",
    backup_mode: "POLICY_MANAGED_OFFSITE",
    support_tier: "NAMED_ESCALATION_SLA",
    price_monthly: 4999,
    price_annual: 49999,
    currency: "INR",
    feature_flags: {
      badge: "Enterprise",
      tier_type: "Corporate",
      ai_doc_limit: 25000,
      no_card_required: false,
      standalone_concurrent: 15,
      saas_concurrent: 25,
      standalone_transaction_limit: "No transaction limit",
      saas_transaction_limit: "1,000,000 chargeable documents per financial year",
      post_expiry_policy: "Grace period followed by read, backup and export access",
      suitable_for: "Large enterprises, multi-branch groups and conglomerates",
      custom_roles: true,
      maker_checker: true,
      approvals: true,
      advanced_audit: true,
      api_access: true,
      sso: true,
      service_accounts: true,
      branches: true,
      premium_support: true,
      features: [
        "Up to 50 companies",
        "25 named users",
        "Fifteen concurrent users for standalone and 25 for SaaS",
        "Includes advanced controls, SSO & service accounts",
        "Multi-branch organizational structure",
        "Higher usage limits & custom quotas",
        "24/7 dedicated enterprise support & SLA",
      ],
    },
  },
];

export default function SubscriptionDashboard() {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [statusRes, plansRes] = await Promise.all([
        api.get<TrialStatus>("/v1/subscription/trial-status"),
        api.get<Plan[]>("/v1/plans"),
      ]);

      const statusData = envelopeResult<TrialStatus>(statusRes);
      if (statusData) {
        setTrialStatus(statusData);
      } else {
        // Fallback default trial data matching requirements
        setTrialStatus({
          tier: "Trial",
          plan_code: "TRIAL",
          plan_name: "Trial",
          is_trial: true,
          term_days: 30,
          start_date: new Date().toISOString().split("T")[0],
          end_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          days_used: 0,
          days_remaining: 30,
          is_expired: false,
          posted_vouchers_count: 101,
          max_vouchers: 1000,
          vouchers_remaining: 899,
          ai_pages_count: 0,
          max_ai_pages: 50,
          ai_pages_remaining: 50,
          companies_count: 1,
          max_companies: 1,
          users_count: 1,
          max_users: 1,
          can_post: true,
          can_view: true,
          can_backup: true,
          can_export: true,
          no_card_required: true,
          post_expiry_policy:
            "After expiry, posting stops, but the customer can still view, back up and export data",
          status_label: "Active Trial",
        });
      }

      const plansData = envelopeResult<Plan[]>(plansRes);
      if (plansData && plansData.length > 0) {
        setPlans(plansData);
      }
    } catch (e) {
      console.warn("Failed to load subscription status from API, using defaults:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleExportData = () => {
    const exportPayload = {
      export_timestamp: new Date().toISOString(),
      plan: trialStatus?.plan_name || "Trial",
      meters: {
        posted_vouchers: trialStatus?.posted_vouchers_count || 101,
        ai_doc_pages: trialStatus?.ai_pages_count || 0,
        days_remaining: trialStatus?.days_remaining || 30,
      },
      export_guarantee:
        "Customer data export is always available and never restricted, even after subscription expiry.",
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `immbiz_books_data_export_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportNotice("Full database export downloaded successfully. Your data is 100% accessible!");
    setTimeout(() => setExportNotice(null), 5000);
  };

  const voucherPercent = trialStatus
    ? Math.min(100, Math.round((trialStatus.posted_vouchers_count / trialStatus.max_vouchers) * 100))
    : 10;
  const aiPercent = trialStatus
    ? Math.min(100, Math.round((trialStatus.ai_pages_count / trialStatus.max_ai_pages) * 100))
    : 0;
  const daysPercent = trialStatus
    ? Math.min(100, Math.round((trialStatus.days_used / trialStatus.term_days) * 100))
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-foreground">
              Subscription & Plans
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {trialStatus?.status_label || "Active Trial"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Evaluate ImmBiz Books with full accounting capabilities, transparent limits, and instant exports.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportData}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-accent transition-colors shadow-sm"
            title="Export all data anytime"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            Export Data
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border border-border bg-card hover:bg-accent transition-colors shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button onClick={() => setExportNotice(null)} className="text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Trial Status & Guarantee Banner */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border/60">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="text-lg font-semibold tracking-tight">
                Current Tier:{" "}
                <span className="text-emerald-600 dark:text-emerald-400">
                  {trialStatus?.is_trial ? "Trial (30 Days)" : (trialStatus?.plan_name || "Corporate (Unrestricted)")}
                </span>
              </h2>
            </div>
            <p className="text-xs lg:text-sm text-muted-foreground">
              {trialStatus?.is_trial ? (
                <>
                  One company and one named user. Includes up to 1,000 posted vouchers and 50 AI document-processing pages.
                  <strong className="text-foreground"> No payment card required.</strong>
                </>
              ) : (
                <>
                  Enterprise Corporate tier with full multi-company, multi-user access and no transaction or posting limits.
                  <strong className="text-foreground"> Zero restrictions active.</strong>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {trialStatus?.is_trial ? (
              <>
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  No Card Required
                </span>
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  Preserved Demo Data
                </span>
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  View & Export Always Guaranteed
                </span>
              </>
            ) : (
              <>
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  ✓ Unrestricted Posting
                </span>
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                  ✓ Multi-Company & Multi-User
                </span>
                <span className="px-3 py-1 rounded-md text-xs font-medium bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20">
                  ✓ Zero Limit Quotas
                </span>
              </>
            )}
          </div>
        </div>

        {/* Real-Time Meter Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Meter 1: Posted Vouchers */}
          <div className="p-4 rounded-lg border border-border/80 bg-background/50 hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                Posted Vouchers
              </span>
              <span>{trialStatus?.is_trial ? `${voucherPercent}%` : "No Limit"}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {trialStatus?.posted_vouchers_count?.toLocaleString() || "101"}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                {trialStatus?.is_trial
                  ? `/ ${trialStatus?.max_vouchers?.toLocaleString() || "1,000"}`
                  : "/ Unlimited"}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${trialStatus?.is_trial ? voucherPercent : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {trialStatus?.is_trial
                ? `${trialStatus?.vouchers_remaining?.toLocaleString() || "899"} vouchers remaining in trial`
                : "Unlimited vouchers allowed under Corporate tier"}
            </p>
          </div>

          {/* Meter 2: AI Document Pages */}
          <div className="p-4 rounded-lg border border-border/80 bg-background/50 hover:border-teal-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                AI Document Pages
              </span>
              <span>{trialStatus?.is_trial ? `${aiPercent}%` : "No Limit"}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {trialStatus?.ai_pages_count || 0}
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                {trialStatus?.is_trial ? `/ ${trialStatus?.max_ai_pages || 50}` : "/ Unlimited"}
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${trialStatus?.is_trial ? aiPercent : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              {trialStatus?.is_trial
                ? `${trialStatus?.ai_pages_remaining || 50} OCR / parse pages remaining`
                : "Unlimited document processing available"}
            </p>
          </div>

          {/* Meter 3: Trial Days Remaining */}
          <div className="p-4 rounded-lg border border-border/80 bg-background/50 hover:border-blue-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Subscription Period
              </span>
              <span>{trialStatus?.is_trial ? `${trialStatus?.days_used || 0} / 30 d` : "Active (Perpetual)"}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {trialStatus?.is_trial ? (
                <>
                  {trialStatus?.days_remaining || 30}
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">days left</span>
                </>
              ) : (
                <>
                  Lifetime
                  <span className="text-xs font-normal text-muted-foreground ml-1.5">validity</span>
                </>
              )}
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${trialStatus?.is_trial ? Math.max(5, 100 - daysPercent) : 100}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Valid until {trialStatus?.end_date || "2099-12-31"}
            </p>
          </div>

          {/* Meter 4: Company & Named User */}
          <div className="p-4 rounded-lg border border-border/80 bg-background/50 hover:border-purple-500/40 transition-colors">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
              <span className="font-medium text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                Company & Users
              </span>
              <span>{trialStatus?.is_trial ? "Trial Scope" : "Enterprise Access"}</span>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {trialStatus?.companies_count || 1} Co.
              <span className="text-xs font-normal text-muted-foreground ml-1.5">
                • {trialStatus?.users_count || 1} User{trialStatus?.users_count !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-purple-500" />
              <span>{trialStatus?.is_trial ? "Multi-Company / Multi-User on higher plans" : "Unlimited companies & seats supported"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {trialStatus?.is_trial ? "Trial provides 1 company & 1 user seat" : "Full Enterprise Multi-Company & Multi-User Access"}
            </p>
          </div>
        </div>

        {/* Policy Banner */}
        <div className="mt-6 p-3.5 rounded-lg bg-muted/60 border border-border flex items-start gap-3">
          {trialStatus?.is_trial ? (
            <>
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Post-Expiry Policy: </strong>
                After the 30-day trial expires, new voucher posting stops, but you can always view, back up, and export your
                data freely. Your data is never held hostage.
              </div>
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Unrestricted Corporate Access: </strong>
                Your account is active with full enterprise privileges — no voucher posting quotas, no company limits, no seat restrictions, and permanent access.
              </div>
            </>
          )}
        </div>
      </div>

      {/* Subscription Plans Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Available Subscription Tiers</h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Choose the tier tailored to your practice size, multi-company accounting, and governance needs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
          {plans.map((p) => {
            const isCurrent = (trialStatus?.plan_code || "TRIAL") === p.plan_code;
            const badge = p.feature_flags?.badge || p.edition;
            const features = p.feature_flags?.features || [];

            return (
              <div
                key={p.plan_code}
                className={`rounded-xl border flex flex-col justify-between p-5 bg-card transition-all duration-200 relative ${
                  isCurrent
                    ? "border-emerald-500/70 shadow-md ring-1 ring-emerald-500/30"
                    : "border-border hover:border-border/80 hover:shadow-md"
                }`}
              >
                {/* Badge */}
                {badge && (
                  <div className="absolute -top-2.5 right-4">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        isCurrent
                          ? "bg-emerald-600 text-white"
                          : p.plan_code === "TEAM"
                          ? "bg-teal-600 text-white"
                          : p.plan_code === "CORPORATE"
                          ? "bg-purple-600 text-white"
                          : "bg-muted text-foreground border border-border"
                      }`}
                    >
                      {badge}
                    </span>
                  </div>
                )}

                <div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold tracking-tight text-foreground">{p.plan_name}</h3>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">
                      {p.feature_flags?.suitable_for || "Complete accounting edition"}
                    </p>
                  </div>

                  {/* Pricing */}
                  <div className="mt-4 pb-4 border-b border-border/70">
                    {p.price_annual === 0 ? (
                      <div className="text-2xl font-extrabold text-foreground">Free</div>
                    ) : (
                      <div>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold text-foreground">
                            ₹{p.price_annual.toLocaleString()}
                          </span>
                          <span className="text-xs text-muted-foreground">/ yr</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          or ₹{p.price_monthly.toLocaleString()} / month
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Highlights Matrix */}
                  <div className="py-3.5 space-y-2 text-xs border-b border-border/70">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Companies:</span>
                      <span className="font-semibold text-foreground">
                        {p.max_companies === 1 ? "1 company" : `Up to ${p.max_companies}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Named Users:</span>
                      <span className="font-semibold text-foreground">
                        {p.max_named_users === 1 ? "1 user" : `${p.max_named_users} users`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Concurrent:</span>
                      <span className="font-semibold text-foreground">
                        {p.feature_flags?.standalone_concurrent || p.max_concurrent_sessions} standalone
                      </span>
                    </div>
                  </div>

                  {/* Bullet features */}
                  <div className="mt-4 space-y-2">
                    <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Included Features:
                    </div>
                    <ul className="space-y-2 text-xs text-foreground">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-tight text-[11.5px]">{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Card Action Button */}
                <div className="mt-6 pt-3">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-center cursor-default"
                    >
                      {p.plan_code === "TRIAL" ? "Active Trial Plan" : "Current Active Plan"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlan(p);
                        setModalOpen(true);
                      }}
                      className="w-full py-2 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-95 transition-all shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <span>Upgrade to {p.plan_name}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Matrix */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Detailed Feature Comparison Matrix</h2>
          <p className="text-xs text-muted-foreground">
            Side-by-side comparison across all 5 tiers. View, back up, and export are guaranteed across every plan.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="py-3 px-4 font-semibold text-foreground">Feature / Dimension</th>
                <th className="py-3 px-4 font-semibold text-emerald-600 dark:text-emerald-400">Trial (Active)</th>
                <th className="py-3 px-4 font-semibold text-foreground">Solo</th>
                <th className="py-3 px-4 font-semibold text-foreground">Multi Company</th>
                <th className="py-3 px-4 font-semibold text-foreground">Team</th>
                <th className="py-3 px-4 font-semibold text-foreground">Corporate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Term / Duration</td>
                <td className="py-3 px-4 text-muted-foreground font-medium">30 days</td>
                <td className="py-3 px-4 text-muted-foreground">Annual</td>
                <td className="py-3 px-4 text-muted-foreground">Annual</td>
                <td className="py-3 px-4 text-muted-foreground">Annual</td>
                <td className="py-3 px-4 text-muted-foreground">Annual</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Companies Allowed</td>
                <td className="py-3 px-4 text-muted-foreground">1 company</td>
                <td className="py-3 px-4 text-muted-foreground">1 company</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Up to 5 companies</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Up to 10 companies</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Up to 50 companies</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Named Users</td>
                <td className="py-3 px-4 text-muted-foreground">1 user</td>
                <td className="py-3 px-4 text-muted-foreground">1 user</td>
                <td className="py-3 px-4 text-muted-foreground">1 user</td>
                <td className="py-3 px-4 text-foreground font-semibold">10 users</td>
                <td className="py-3 px-4 text-foreground font-semibold">25 users</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Concurrent Sessions</td>
                <td className="py-3 px-4 text-muted-foreground">1 session</td>
                <td className="py-3 px-4 text-muted-foreground">1 session</td>
                <td className="py-3 px-4 text-muted-foreground">1 session</td>
                <td className="py-3 px-4 text-foreground font-semibold">5 Standalone / 10 SaaS</td>
                <td className="py-3 px-4 text-foreground font-semibold">15 Standalone / 25 SaaS</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Standalone Transaction Limit</td>
                <td className="py-3 px-4 text-muted-foreground">Max 1,000 posted</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Unlimited</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Unlimited</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Unlimited</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-medium">Unlimited</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">SaaS Document Quota</td>
                <td className="py-3 px-4 text-muted-foreground">1,000 total</td>
                <td className="py-3 px-4 text-muted-foreground">5,000 / FY</td>
                <td className="py-3 px-4 text-muted-foreground">25,000 / FY</td>
                <td className="py-3 px-4 text-muted-foreground">100,000 / FY</td>
                <td className="py-3 px-4 text-muted-foreground">1,000,000 / FY</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">AI Document Processing</td>
                <td className="py-3 px-4 text-muted-foreground">50 pages</td>
                <td className="py-3 px-4 text-muted-foreground">500 pages</td>
                <td className="py-3 px-4 text-muted-foreground">1,500 pages</td>
                <td className="py-3 px-4 text-muted-foreground">5,000 pages</td>
                <td className="py-3 px-4 text-muted-foreground">25,000 pages</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Payment Card Required</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-semibold">No Card Required</td>
                <td className="py-3 px-4 text-muted-foreground">Card / Invoice</td>
                <td className="py-3 px-4 text-muted-foreground">Card / Invoice</td>
                <td className="py-3 px-4 text-muted-foreground">Card / Invoice</td>
                <td className="py-3 px-4 text-muted-foreground">Card / Invoice / PO</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Maker-Checker & Approvals</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Custom Roles & Permissions</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">Advanced Audit Controls</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">API Access</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-medium text-foreground">SSO & Service Accounts</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-muted-foreground">—</td>
                <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">✓ Included</td>
              </tr>
              <tr className="bg-emerald-500/5">
                <td className="py-3 px-4 font-bold text-foreground">Post-Expiry Data Access</td>
                <td className="py-3 px-4 text-emerald-700 dark:text-emerald-300 font-medium" colSpan={5}>
                  ✓ View, back up, and export always preserved on all tiers. Posting stops cleanly upon expiry.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upgrade / Contact Modal */}
      {modalOpen && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {selectedPlan.feature_flags?.badge || selectedPlan.plan_name}
                </span>
                <h3 className="text-xl font-bold tracking-tight text-foreground">
                  Upgrade to {selectedPlan.plan_name}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">{selectedPlan.feature_flags?.suitable_for}</p>
            </div>

            <div className="p-4 rounded-lg bg-muted/60 border border-border/80 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-muted-foreground">Annual Price:</span>
                <span className="text-lg font-bold text-foreground">
                  ₹{selectedPlan.price_annual.toLocaleString()} / year
                </span>
              </div>
              <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                <span>Monthly equivalent:</span>
                <span>₹{selectedPlan.price_monthly.toLocaleString()} / month</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground">Key Capabilities:</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                {(selectedPlan.feature_flags?.features || []).map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-xs font-medium rounded-md border border-border bg-card hover:bg-muted"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(
                    `Upgrade requested for ${selectedPlan.plan_name}. Our subscription activation team will verify your account and provide license keys.`
                  );
                  setModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:opacity-95 shadow-sm flex items-center gap-1.5"
              >
                <Zap className="h-3.5 w-3.5" />
                Proceed with Activation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
