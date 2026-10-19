import {
  BarChart3,
  Building2,
  CreditCard,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';

const FEATURES = [
  { icon: Users, label: 'Manage Leads' },
  { icon: CreditCard, label: 'Compare Cards' },
  { icon: BarChart3, label: 'Track Payouts' },
  { icon: ShieldCheck, label: 'Secure & Reliable' },
];

const STATS = [
  { icon: Users, value: 'OTP-only', label: 'Secure sign-in' },
  { icon: ShieldCheck, value: 'Role-based', label: 'Access control' },
  { icon: Zap, value: 'Dual', label: 'Payout approvals' },
];

export function LoginShowcase() {
  return (
    <section className="relative hidden h-dvh flex-col overflow-hidden bg-navy p-10 text-white lg:flex xl:px-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 -right-56 size-[620px] rounded-full border border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(240,90,40,0.16),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-64 -left-40 size-[560px] rounded-full border border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(163,163,163,0.12)_1px,transparent_1px)] [background-size:26px_26px]"
      />

      <header className="relative flex items-center gap-3">
        <span className="flex size-11 items-center justify-center brand-gradient rounded-full text-white shadow-lg shadow-black/30">
          <Building2 className="size-6" />
        </span>
        <span className="flex flex-col">
          <span className="text-xl leading-tight font-bold tracking-tight">
            KBS<span className="font-normal text-white/70"> Solutions</span>
          </span>
          <span className="text-xs text-white/60">Credit card DSA platform</span>
        </span>
      </header>

      <div className="relative flex min-h-0 flex-1 items-center gap-6">
        <div className="min-w-0 max-w-xl">
          <h1 className="text-5xl leading-[1.08] font-bold tracking-tight xl:text-6xl">
            Every lead.
            <br />
            Every decision.
            <br />
            <span className="text-brand">One clear view.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-white/70">
            People, bank data and payouts—connected in one workspace.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-4 gap-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-start gap-2.5">
                <span className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                  <Icon className="size-5 text-neutral-400" />
                </span>
                <span className="text-[11px] leading-tight text-white/70">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <HeroArt />
      </div>

      <div className="relative mb-5 flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/[0.04] px-8 py-4 backdrop-blur">
        {STATS.map(({ icon: Icon, value, label }, i) => (
          <div key={label} className="flex flex-1 items-center gap-3">
            {i > 0 ? <span className="mr-3 h-10 w-px bg-white/10" aria-hidden="true" /> : null}
            <span className="flex size-10 items-center justify-center rounded-full bg-neutral-500/15">
              <Icon className="size-5 text-neutral-400" />
            </span>
            <span>
              <span className="block text-lg leading-tight font-bold">{value}</span>
              <span className="block text-[11px] text-white/60">{label}</span>
            </span>
          </div>
        ))}
      </div>

      <footer className="relative flex items-center justify-between text-[11px] text-white/50">
        <span>© KBS Solutions</span>
      </footer>
    </section>
  );
}

function HeroArt() {
  return (
    <div className="relative hidden min-w-0 flex-1 xl:block">
      <svg
        viewBox="0 0 440 360"
        role="img"
        aria-label="KBS advisor credit card"
        className="login-float mx-auto w-full max-w-[440px]"
      >
        <defs>
          <linearGradient id="hc-front" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#F47A45" />
            <stop offset="0.55" stopColor="#F05A28" />
            <stop offset="1" stopColor="#C2410C" />
          </linearGradient>
          <linearGradient id="hc-back" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2a2a2a" />
            <stop offset="1" stopColor="#171717" />
          </linearGradient>
        </defs>

        {/* orbit ring */}
        <circle
          cx="215"
          cy="185"
          r="150"
          fill="none"
          stroke="#F05A28"
          strokeOpacity="0.3"
          strokeWidth="1.5"
          strokeDasharray="3 9"
        />

        {/* back card */}
        <g transform="rotate(10 260 128)">
          <rect x="170" y="62" width="200" height="126" rx="18" fill="url(#hc-back)" />
          <rect x="170" y="86" width="200" height="22" fill="#0a0a0a" />
          <rect x="186" y="132" width="66" height="10" rx="5" fill="#404040" />
          <rect x="186" y="152" width="100" height="8" rx="4" fill="#333333" />
        </g>

        {/* front card */}
        <g transform="rotate(-8 185 205)">
          <rect x="70" y="140" width="230" height="144" rx="20" fill="url(#hc-front)" />
          <rect x="70" y="140" width="230" height="144" rx="20" fill="white" opacity="0.05" />
          <rect x="92" y="168" width="40" height="30" rx="7" fill="#fbbf24" />
          <path d="M92 183h40M112 168v30" stroke="#b45309" strokeWidth="1.5" />
          <path
            d="M148 176a10 10 0 0 1 0 14M155 170a17 17 0 0 1 0 26M162 164a24 24 0 0 1 0 38"
            stroke="#FDBA74"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
          <text x="92" y="240" fill="#FFF7ED" fontSize="15" letterSpacing="3" fontFamily="monospace">
            •••• •••• •••• 4821
          </text>
          <text x="92" y="266" fill="#FED7AA" fontSize="10" letterSpacing="2">
            KBS ADVISOR
          </text>
          <circle cx="240" cy="258" r="13" fill="#f87171" opacity="0.9" />
          <circle cx="258" cy="258" r="13" fill="#fbbf24" opacity="0.85" />
        </g>

        {/* orbit bubbles: bank / growth / shield */}
        <g transform="translate(118 62)">
          <circle r="27" fill="#1f1f1f" stroke="#F05A28" strokeOpacity="0.6" strokeWidth="1.5" />
          <path d="M-9 9h18M-9 9v-9h18v9M-9 0l9-7 9 7" stroke="#FDBA74" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
          <path d="M-4.5 9V4M0 9V4M4.5 9V4" stroke="#FDBA74" strokeWidth="1.8" />
        </g>
        <g transform="translate(315 78)">
          <circle r="27" fill="#1f1f1f" stroke="#a3a3a3" strokeOpacity="0.6" strokeWidth="1.5" />
          <path d="M-10 7l6-6 4 4 9-10" stroke="#a3a3a3" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 -5h5v5" stroke="#a3a3a3" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform="translate(335 235)">
          <circle r="27" fill="#1f1f1f" stroke="#F05A28" strokeOpacity="0.6" strokeWidth="1.5" />
          <path
            d="M0-10l8 3v6c0 6-3.5 9.5-8 12-4.5-2.5-8-6-8-12v-6z"
            stroke="#FDBA74"
            strokeWidth="1.8"
            fill="none"
            strokeLinejoin="round"
          />
          <path d="M-3.5-1l2.5 2.5L4-4" stroke="#FDBA74" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>

        {/* handwritten annotations */}
        <text x="330" y="30" fill="#FDBA74" fontSize="15" fontStyle="italic" fontFamily="cursive">
          Grow
        </text>
        <text x="330" y="48" fill="#FDBA74" fontSize="15" fontStyle="italic" fontFamily="cursive">
          Together
        </text>
        <path d="M352 56q6 14 2 26" stroke="#FDBA74" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M349 76l5 8 7-6" stroke="#FDBA74" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <text x="20" y="330" fill="#a3a3a3" fontSize="14" fontStyle="italic" fontFamily="cursive">
          More Banks, More Opportunities
        </text>
        <path d="M205 322q16-4 26-16" stroke="#a3a3a3" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M225 313l7-8 2 10" stroke="#a3a3a3" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
