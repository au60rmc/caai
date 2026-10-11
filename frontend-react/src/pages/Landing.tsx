import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  BookMarked,
  ChevronDown,
  Menu,
  X,
  CheckCircle2,
  Check,
  FileText,
  Building2,
  Boxes,
  Users,
  Clock,
  BarChart3,
  Quote,
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";

/* Design tokens — matches the app shell (ink / oxide-teal / brass) */
const TEAL = "#0C6B62";
const TEAL_SOFT = "#E3F0EE";
const BRASS = "#B98A2F";
const BRASS_SOFT = "#F5EBD6";
const INK = "#121924";
const INK_3 = "#232E3F";
const RED = "#B42318";

const FEATURES = [
  { icon: FileText, title: "GST Compliance", desc: "File returns, e-invoices and e-way bills with auto tax calculation." },
  { icon: Building2, title: "Connected Banking", desc: "Sync bank feeds and reconcile transactions in a click." },
  { icon: Boxes, title: "Inventory Management", desc: "Track stock, valuations and reorder levels in real time." },
  { icon: Users, title: "Vendor Portals", desc: "Let vendors and customers self-serve invoices and payments." },
  { icon: Clock, title: "Time Tracking", desc: "Bill hours accurately and turn timesheets into invoices." },
  { icon: BarChart3, title: "Financial Reports", desc: "P&L, balance sheet and cash-flow insights on demand." },
];

const FAQ = [
  {
    q: "Is ImmBiz Books compliant with Indian GST regulations?",
    a: "Yes, ImmBiz Books is fully compliant with Indian GST regulations. We support GST filing, e-invoicing, e-way bills, and all applicable tax calculations including reverse charge mechanism.",
  },
  {
    q: "Can I import data from my existing accounting software?",
    a: "Absolutely! We support data import from popular accounting software like Tally, QuickBooks, Zoho Books, and Excel spreadsheets. Our migration team can assist with the transition.",
  },
  {
    q: "Is my data secure with ImmBiz Books?",
    a: "Security is our top priority. We use 256-bit AES encryption, regular backups, and comply with Indian data protection laws. Your financial data is stored in secure data centers within India.",
  },
];

const STATS = [
  { v: "5,00,000+", l: "Indian businesses" },
  { v: "₹1,200 Cr", l: "invoiced every month" },
  { v: "99.95%", l: "platform uptime" },
  { v: "4.8 / 5", l: "customer rating" },
];

/* Small hero-mockup area chart */
function MiniArea() {
  const rev = [38, 44, 41, 52, 58, 54, 63, 70, 66, 76, 82, 90];
  const exp = [30, 33, 34, 40, 43, 42, 47, 52, 50, 55, 58, 61];
  const W = 300, H = 88, max = 100;
  const pt = (v: number, i: number) => `${(i / (rev.length - 1)) * W},${H - (v / max) * H}`;
  const path = (s: number[]) => s.map((v, i) => `${i ? "L" : "M"}${pt(v, i)}`).join(" ");
  const area = (s: number[]) => `${path(s)} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[88px]" aria-hidden>
      <defs>
        <linearGradient id="lgA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={TEAL} stopOpacity="0.25" />
          <stop offset="100%" stopColor={TEAL} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line key={t} x1="0" x2={W} y1={H * t} y2={H * t} stroke="#ECEAE1" strokeWidth="1" />
      ))}
      <path d={area(rev)} fill="url(#lgA)" />
      <path d={path(exp)} fill="none" stroke={BRASS} strokeWidth="1.8" />
      <path d={path(rev)} fill="none" stroke={TEAL} strokeWidth="2.2" />
      <circle cx={W} cy={H - (rev[11] / max) * H} r="3.5" fill={TEAL} stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function Landing() {
  const [yearly, setYearly] = useState(false);
  const [featOpen, setFeatOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [faq, setFaq] = useState<number | null>(0);
  const [demoEmail, setDemoEmail] = useState("");

  const { demoLogin } = useAuth() || {};
  const navigate = useNavigate();

  const handleDemo = async () => {
    if (!demoEmail || !/^\S+@\S+\.\S+$/.test(demoEmail)) {
      alert("Please enter a valid email to try the demo.");
      return;
    }
    if (demoLogin) {
      const res = await demoLogin(demoEmail);
      if (res.ok) {
        navigate("/app/dashboard");
      } else {
        alert(res.message);
      }
    }
  };

  const prices = { standard: yearly ? 749 : 899, professional: yearly ? 1499 : 1799 };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Announcement bar ─────────────────────────────── */}
      <div className="text-center py-2 px-4 text-[13px] text-[#B9C1CC]" style={{ background: INK }}>
        <span className="inline-block h-1.5 w-1.5 rounded-full mr-2 align-middle" style={{ background: BRASS }} />
        <span className="text-white font-medium">New:</span> Multi-company support is now live.
        <Link to="/login" className="ml-2 font-semibold underline underline-offset-2" style={{ color: BRASS }}>
          Learn more
        </Link>
      </div>

      {/* ── Header ───────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[64px]">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="h-8 w-8 rounded-md grid place-items-center" style={{ background: TEAL }}>
                <BookMarked className="h-[18px] w-[18px] text-white" />
              </span>
              <span className="leading-tight">
                <span className="block text-[15px] font-semibold tracking-tight">ImmBiz Books</span>
                <span className="block text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Accounting</span>
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-7">
              <div className="relative">
                <button
                  onClick={() => setFeatOpen((o) => !o)}
                  className="flex items-center gap-1 text-[13.5px] font-medium hover:text-[#0C6B62] transition-colors"
                >
                  Features <ChevronDown className={"h-3.5 w-3.5 transition " + (featOpen ? "rotate-180" : "")} />
                </button>
                {featOpen && (
                  <div
                    className="absolute top-full left-0 mt-2 card-panel py-1.5 min-w-[230px]"
                    onClick={() => setFeatOpen(false)}
                  >
                    {["GST Compliance", "Connected Banking", "Inventory Management"].map((f) => (
                      <a key={f} href="#features" className="flex items-center justify-between px-4 py-2 text-[13px] hover:bg-muted/60">
                        {f} <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {["Pricing", "Customers", "FAQ"].map((l) => (
                <a key={l} href={"#" + l.toLowerCase()} className="text-[13.5px] font-medium hover:text-[#0C6B62] transition-colors">
                  {l}
                </a>
              ))}
            </div>

            <div className="hidden lg:flex items-center gap-2.5">
              <Link to="/login" className="text-[13.5px] font-semibold px-3.5 py-2 rounded-[5px] hover:bg-muted transition-colors" style={{ color: TEAL }}>
                Sign in
              </Link>
              <button
                onClick={handleDemo}
                className="rounded-[5px] px-4 py-2 text-white text-[13.5px] font-semibold shadow-sm hover:opacity-90 transition-opacity"
                style={{ background: TEAL }}
              >
                Try Public Demo
              </button>
            </div>

            <button className="lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu">
              <Menu className="h-6 w-6" style={{ color: INK }} />
            </button>
          </div>
        </nav>

        {mobile && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/45" onClick={() => setMobile(false)} />
            <div className="absolute right-0 top-0 h-full w-80 bg-card shadow-xl p-6">
              <div className="flex justify-end">
                <button onClick={() => setMobile(false)} aria-label="Close menu">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="flex flex-col gap-1 mt-4">
                {["Features", "Pricing", "Customers", "FAQ"].map((l) => (
                  <a
                    key={l}
                    href={"#" + l.toLowerCase()}
                    className="text-[15px] font-medium px-3 py-2.5 rounded-[5px] hover:bg-muted"
                    onClick={() => setMobile(false)}
                  >
                    {l}
                  </a>
                ))}
                <hr className="my-3" />
                <Link to="/login" className="text-[15px] font-semibold px-3 py-2.5" style={{ color: TEAL }}>
                  Sign in
                </Link>
                <button
                  onClick={handleDemo}
                  className="mt-1 rounded-[5px] px-4 py-2.5 text-white text-center font-semibold"
                  style={{ background: TEAL }}
                >
                  Try Public Demo
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
      <section className="pt-16 lg:pt-24 pb-14 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.5]"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 31px, #E9E6DC 31px, #E9E6DC 32px)" }}
          aria-hidden
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="grid lg:grid-cols-2 gap-14 items-center">
            <div>
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] px-3 py-1.5 rounded-full"
                style={{ background: TEAL_SOFT, color: TEAL }}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Trusted by 5,00,000+ Indian businesses
              </span>
              <h1 className="mt-5 text-[40px] lg:text-[52px] leading-[1.08] font-semibold tracking-tight" style={{ color: INK }}>
                Accounting that keeps
                <br />
                <span className="fig italic" style={{ color: TEAL }}>every rupee</span> accounted.
              </h1>
              <p className="text-[16.5px] text-muted-foreground mt-5 max-w-xl leading-relaxed">
                Streamline your finances, automate GST filing, and grow your business with
                India's most trusted accounting platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 mt-8 max-w-lg">
                <input
                  id="hero-email"
                  name="email"
                  type="email"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  placeholder="Enter your work email"
                  aria-label="Enter your work email"
                  className="flex-1 h-11 rounded-[5px] border border-input px-3.5 bg-card text-[14px] outline-none focus:ring-2 focus:ring-[#0C6B62]/30"
                />
                <button
                  onClick={handleDemo}
                  className="h-11 rounded-[5px] px-6 inline-flex items-center justify-center gap-1.5 text-white font-semibold hover:opacity-90 transition-opacity"
                  style={{ background: TEAL }}
                >
                  Try Public Demo <ArrowRight className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap gap-5 mt-4 text-[13px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" style={{ color: TEAL }} /> Free 14-day trial
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" style={{ color: TEAL }} /> No credit card required
                </span>
              </div>
            </div>

            {/* Product mockup — matches the real app shell */}
            <div className="relative">
              <div className="absolute -inset-4 rounded-2xl opacity-60" style={{ background: `radial-gradient(60% 60% at 70% 30%, ${TEAL_SOFT}, transparent)` }} aria-hidden />
              <div className="relative card-panel overflow-hidden">
                <div className="flex">
                  <div className="w-14 p-3 space-y-3 shrink-0" style={{ background: INK }}>
                    <div className="h-7 w-7 rounded-md grid place-items-center" style={{ background: TEAL }}>
                      <BookMarked className="h-3.5 w-3.5 text-white" />
                    </div>
                    <div className="pt-2 space-y-2.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-2 rounded-sm" style={{ background: i === 1 ? BRASS : "rgba(255,255,255,0.14)" }} />
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 p-4 bg-card">
                    <div className="flex items-center justify-between pb-3 ledger-rule">
                      <div>
                        <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Sangaranarayanan &amp; Co</div>
                        <div className="text-[13px] font-semibold">Dashboard · FY 2026–27</div>
                      </div>
                      <div className="h-7 w-7 rounded-full grid place-items-center text-white text-[9px] font-semibold" style={{ background: INK_3 }}>SN</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2.5 my-3.5">
                      {[
                        { l: "Net profit", v: "₹12.8 L", c: "+12.5%", up: true },
                        { l: "Receivables", v: "₹3.4 L", c: "−2.1%", up: false },
                        { l: "GST payable", v: "₹89.2k", c: "+4.3%", up: true },
                      ].map((c) => (
                        <div key={c.l} className="rounded-[5px] border border-border p-2.5">
                          <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{c.l}</div>
                          <div className="fig text-[15px] mt-0.5">{c.v}</div>
                          <div className="flex items-center gap-0.5 text-[9.5px] font-semibold" style={{ color: c.up ? TEAL : RED }}>
                            {c.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
                            {c.c}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-[5px] border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[9px] uppercase tracking-[0.12em] font-semibold text-muted-foreground">Revenue vs Expenses</span>
                        <span className="flex gap-3 text-[9px] text-muted-foreground">
                          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-[2px] inline-block" style={{ background: TEAL }} />Revenue</span>
                          <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-[2px] inline-block" style={{ background: BRASS }} />Expenses</span>
                        </span>
                      </div>
                      <MiniArea />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
          {STATS.map((s) => (
            <div key={s.l} className="py-7 px-4 text-center">
              <div className="fig text-[26px]" style={{ color: INK }}>{s.v}</div>
              <div className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section id="features" className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <div className="eyebrow" style={{ color: BRASS }}>Capabilities</div>
            <h2 className="text-[30px] font-semibold tracking-tight mt-2" style={{ color: INK }}>
              Everything you need to run the books
            </h2>
            <p className="text-muted-foreground mt-2.5 text-[15px]">
              From invoicing to compliance — one ledger, no loose ends.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <div key={f.title} className="card-panel p-6 group hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-11 w-11 rounded-[8px] grid place-items-center" style={{ background: TEAL_SOFT }}>
                    <f.icon className="h-5 w-5" style={{ color: TEAL }} />
                  </div>
                  <span className="mono text-[10px] px-1.5 py-0.5 rounded-[3px] text-muted-foreground bg-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="font-semibold text-[16px]" style={{ color: INK }}>{f.title}</h3>
                <p className="text-[13.5px] text-muted-foreground mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tour / invoice ───────────────────────────────── */}
      <section className="py-16 lg:py-24 border-y border-border bg-card/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="eyebrow" style={{ color: BRASS }}>GST-ready invoicing</div>
            <h2 className="text-[30px] font-semibold tracking-tight mt-2" style={{ color: INK }}>
              GST-compliant invoices in minutes
            </h2>
            <p className="text-muted-foreground mt-3 text-[15px] leading-relaxed">
              Generate professional invoices fully compliant with Indian GST regulations.
              Auto-calculate taxes, apply reverse charge, and file returns seamlessly.
            </p>
            <ul className="space-y-3 mt-6">
              {[
                "Auto-calculates GST, TDS, and other taxes",
                "Supports e-invoicing and e-way bills",
                "Direct integration with the GST portal",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-[14.5px]">
                  <span className="h-5 w-5 rounded-full grid place-items-center shrink-0" style={{ background: TEAL_SOFT }}>
                    <Check className="h-3 w-3" style={{ color: TEAL }} />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
            <button
              onClick={handleDemo}
              className="inline-flex items-center gap-1.5 mt-8 rounded-[5px] px-5 py-2.5 text-white font-semibold hover:opacity-90 transition-opacity"
              style={{ background: TEAL }}
            >
              Try Public Demo <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="card-panel p-6 max-w-md w-full mx-auto">
            <div className="flex items-center justify-between pb-3 ledger-rule">
              <div>
                <div className="eyebrow">Tax invoice</div>
                <div className="mono text-[12px] text-muted-foreground mt-0.5">SI-001083 · 20 Jul 2026</div>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-full" style={{ background: TEAL_SOFT, color: TEAL }}>
                GST · 33
              </span>
            </div>
            <div className="py-3 space-y-2.5 text-[13.5px]">
              <div className="flex justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>Particulars</span><span>Amount</span>
              </div>
              <div className="flex justify-between"><span>Consulting services</span><span className="fig">₹ 50,000.00</span></div>
              <div className="flex justify-between text-muted-foreground"><span>CGST @ 9%</span><span className="fig">₹ 4,500.00</span></div>
              <div className="flex justify-between text-muted-foreground"><span>SGST @ 9%</span><span className="fig">₹ 4,500.00</span></div>
            </div>
            <div className="flex justify-between items-baseline pt-3 ledger-rule-strong">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total payable</span>
              <span className="fig text-[22px]" style={{ color: TEAL }}>₹ 59,000.00</span>
            </div>
            <div className="mt-3 text-[11px] text-muted-foreground">Rupees fifty-nine thousand only · E-invoice IRN generated</div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────── */}
      <section id="pricing" className="py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-7">
            <div className="eyebrow" style={{ color: BRASS }}>Pricing</div>
            <h2 className="text-[30px] font-semibold tracking-tight mt-2" style={{ color: INK }}>
              Simple, transparent pricing
            </h2>
          </div>
          <div className="flex items-center justify-center gap-3 mb-10">
            <span className={"text-[13.5px] " + (!yearly ? "font-semibold" : "text-muted-foreground")}>Monthly</span>
            <button
              onClick={() => setYearly((y) => !y)}
              className="relative h-6 w-11 rounded-full transition-colors"
              style={{ background: yearly ? TEAL : "hsl(var(--input))" }}
              aria-label="Toggle yearly pricing"
            >
              <span
                className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: yearly ? "translateX(20px)" : "none" }}
              />
            </button>
            <span className={"text-[13.5px] " + (yearly ? "font-semibold" : "text-muted-foreground")}>Yearly</span>
            {yearly && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: BRASS_SOFT, color: "#8A6420" }}>
                Save 20%
              </span>
            )}
          </div>
          <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto items-stretch">
            <PriceCard
              title="Free"
              desc="Basic accounting for individuals"
              price="₹0"
              features={["Up to 10 invoices/month", "Basic expense tracking", "Bank reconciliation", "Email support"]}
            />
            <PriceCard
              featured
              title="Standard"
              desc="Complete accounting for small businesses"
              price={`₹${prices.standard}`}
              suffix="/mo"
              features={[
                "Unlimited invoices",
                "GST filing & compliance",
                "Inventory management",
                "Multi-user access",
                "Priority support",
              ]}
            />
            <PriceCard
              title="Professional"
              desc="Advanced tools for growing enterprises"
              price={`₹${prices.professional}`}
              suffix="/mo"
              features={[
                "Everything in Standard",
                "Connected banking",
                "Vendor & customer portals",
                "Custom reports & analytics",
                "Dedicated account manager",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────── */}
      <section id="customers" className="py-16 lg:py-24 border-y border-border bg-card/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="eyebrow" style={{ color: BRASS }}>Customers</div>
            <h2 className="text-[30px] font-semibold tracking-tight mt-2" style={{ color: INK }}>
              Loved by thousands of businesses
            </h2>
            <p className="text-muted-foreground mt-2 text-[15px]">Hear from our customers across India</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {[
              {
                q: "ImmBiz Books transformed how we manage our finances. GST filing used to take days; now it's done in minutes.",
                a: "Rajesh Kumar",
                r: "Founder, TechVista Solutions",
              },
              {
                q: "The inventory management and banking integration saved us countless hours. Highly recommended for any growing business.",
                a: "Priya Sharma",
                r: "CEO, EcoGrow Enterprises",
              },
            ].map((t) => (
              <figure key={t.a} className="card-panel p-7">
                <Quote className="h-6 w-6" style={{ color: BRASS }} />
                <blockquote className="fig italic text-[16.5px] leading-relaxed mt-3.5" style={{ color: INK }}>
                  “{t.q}”
                </blockquote>
                <figcaption className="flex items-center gap-3 mt-5 pt-4 ledger-rule-strong">
                  <span className="h-10 w-10 rounded-full grid place-items-center text-white text-[13px] font-semibold" style={{ background: INK_3 }}>
                    {t.a.split(" ").map((w) => w[0]).join("")}
                  </span>
                  <span>
                    <span className="block font-semibold text-[14px]">{t.a}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{t.r}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="py-16 lg:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <div className="eyebrow" style={{ color: BRASS }}>FAQ</div>
            <h2 className="text-[30px] font-semibold tracking-tight mt-2" style={{ color: INK }}>
              Frequently asked questions
            </h2>
          </div>
          <div className="card-panel divide-y divide-border overflow-hidden">
            {FAQ.map((f, i) => (
              <div key={i}>
                <button
                  className="w-full flex items-center justify-between gap-4 px-6 py-[18px] text-left text-[14.5px] font-medium hover:bg-muted/40 transition-colors"
                  onClick={() => setFaq(faq === i ? null : i)}
                  aria-expanded={faq === i}
                >
                  {f.q}
                  <ChevronDown className={"h-[18px] w-[18px] shrink-0 text-muted-foreground transition " + (faq === i ? "rotate-180" : "")} />
                </button>
                {faq === i && <div className="px-6 pb-5 text-[13.5px] text-muted-foreground leading-relaxed">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="py-20 relative overflow-hidden" style={{ background: INK }}>
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(to bottom, transparent, transparent 27px, #fff 27px, #fff 28px)" }}
          aria-hidden
        />
        <div className="max-w-3xl mx-auto px-4 text-center relative">
          <div className="eyebrow" style={{ color: BRASS }}>Get started</div>
          <h2 className="text-[32px] font-semibold tracking-tight text-white mt-2">
            Ready to balance the books?
          </h2>
          <p className="mt-3 text-[15px] text-[#9AA3B2]">
            Join 5,00,000+ Indian businesses that trust ImmBiz Books for their accounting.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Link
              to="/login"
              className="rounded-[5px] px-6 py-3 font-semibold text-white inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ background: TEAL }}
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="rounded-[5px] border border-white/25 px-6 py-3 font-semibold text-white hover:bg-white/[0.06] transition-colors"
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="pt-14 pb-8 border-t border-white/10" style={{ background: INK }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-10 text-[#8A93A1]">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <span className="h-8 w-8 rounded-md grid place-items-center" style={{ background: TEAL }}>
                  <BookMarked className="h-[18px] w-[18px] text-white" />
                </span>
                <span className="text-[16px] font-semibold text-white">ImmBiz Books</span>
              </div>
              <p className="text-[13px] leading-relaxed">
                India's most trusted accounting platform for small and medium businesses.
                Streamline your finances, automate compliance, and focus on growth.
              </p>
            </div>
            <FooterCol title="Features" links={["GST Compliance", "Connected Banking", "Inventory", "Financial Reports"]} />
            <FooterCol title="Resources" links={["Help Center", "API Documentation", "Community Forum", "Blog"]} />
            <div>
              <h4 className="text-white text-[11px] font-semibold uppercase tracking-[0.14em] mb-4">Contact</h4>
              <ul className="space-y-2.5 text-[13px]">
                <li className="flex items-center gap-2.5"><Phone className="h-3.5 w-3.5" style={{ color: BRASS }} /> +91 1800-123-4567</li>
                <li className="flex items-center gap-2.5"><Mail className="h-3.5 w-3.5" style={{ color: BRASS }} /> support@immbizbooks.com</li>
                <li className="flex items-center gap-2.5"><MapPin className="h-3.5 w-3.5" style={{ color: BRASS }} /> Bangalore, Karnataka, India</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-[#67707E]">
            <span>© 2026 ImmBiz Books. All rights reserved.</span>
            <span className="mono">All figures in INR</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PriceCard({
  title,
  desc,
  price,
  suffix,
  features,
  featured,
}: {
  title: string;
  desc: string;
  price: string;
  suffix?: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className="card-panel p-6 flex flex-col relative"
      style={featured ? { borderColor: TEAL, boxShadow: `0 0 0 1px ${TEAL}, 0 8px 24px -12px rgba(12,107,98,0.35)` } : undefined}
    >
      {featured && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold uppercase tracking-[0.1em] px-3 py-1 rounded-full text-white whitespace-nowrap"
          style={{ background: BRASS }}
        >
          Most popular
        </span>
      )}
      <h3 className="font-semibold text-[16px]" style={{ color: INK }}>{title}</h3>
      <p className="text-[12.5px] text-muted-foreground mt-1">{desc}</p>
      <div className="flex items-baseline gap-1 mt-5 pb-4 ledger-rule">
        <span className="fig text-[34px] leading-none" style={{ color: featured ? TEAL : INK }}>{price}</span>
        {suffix && <span className="text-[13px] text-muted-foreground">{suffix}</span>}
      </div>
      <ul className="space-y-2.5 mt-4 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[13.5px]">
            <Check className="h-4 w-4 shrink-0" style={{ color: TEAL }} /> {f}
          </li>
        ))}
      </ul>
      <Link
        to="/login"
        className="mt-6 rounded-[5px] py-2.5 text-center font-semibold text-[13.5px] transition-opacity hover:opacity-90"
        style={featured
          ? { background: TEAL, color: "#fff" }
          : { border: `1px solid ${TEAL}`, color: TEAL }}
      >
        Start free trial
      </Link>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <h4 className="text-white text-[11px] font-semibold uppercase tracking-[0.14em] mb-4">{title}</h4>
      <ul className="space-y-2.5 text-[13px]">
        {links.map((l) => (
          <li key={l}>
            <a href="#" className="hover:text-white transition-colors">{l}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
