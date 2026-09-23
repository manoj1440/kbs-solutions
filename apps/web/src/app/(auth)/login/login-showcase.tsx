'use client';

import { Building2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

const SLIDES = [
  {
    eyebrow: 'Credit card DSA platform',
    title: 'Every lead. Every decision. One clear view.',
    text: 'People, bank data and payouts—connected in one workspace.',
    art: <CardsArt />,
  },
  {
    eyebrow: 'Bank MIS intelligence',
    title: 'Uploaded MIS is the single source of truth.',
    text: 'Evidence-backed status on every application, exceptions surfaced.',
    art: <MisArt />,
  },
  {
    eyebrow: 'Payout oversight',
    title: 'Eligibility to payment, fully traceable.',
    text: 'Rule-based eligibility, dual approval and payment visibility.',
    art: <PayoutArt />,
  },
  {
    eyebrow: 'Team operations',
    title: 'Telecallers, managers and advisors in sync.',
    text: 'Allocation, follow-ups and outcomes—live on one board.',
    art: <TeamArt />,
  },
];

export function LoginShowcase() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative hidden h-dvh flex-col overflow-hidden bg-[#0c1526] p-10 text-white lg:flex xl:p-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-56 -right-56 size-[620px] rounded-full border border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.12),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-64 -left-40 size-[560px] rounded-full border border-white/5 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.08),transparent_65%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgba(148,163,184,0.14)_1px,transparent_1px)] [background-size:26px_26px]"
      />

      <div className="relative flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-teal-300 text-slate-900">
          <Building2 className="size-6" />
        </span>
        <span className="text-xl font-bold tracking-tight">
          KBS<span className="font-normal text-slate-300"> Solutions</span>
        </span>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col justify-center py-6">
        {SLIDES.map((s, i) => (
          <div
            key={s.eyebrow}
            aria-hidden={i !== index}
            className={`absolute inset-0 flex flex-col justify-center transition-all duration-700 ease-out ${
              i === index
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-4 opacity-0'
            }`}
          >
            <div className="login-float mx-auto w-full max-w-md">{s.art}</div>
            <p className="mt-8 text-[11px] font-semibold tracking-[0.2em] text-teal-300 uppercase">
              {s.eyebrow}
            </p>
            <h1 className="mt-3 max-w-xl text-4xl leading-[1.15] font-semibold tracking-tight xl:text-5xl">
              {s.title}
            </h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-slate-300">{s.text}</p>
          </div>
        ))}
      </div>

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.eyebrow}
              type="button"
              aria-label={`Show slide ${i + 1}: ${s.eyebrow}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === index ? 'w-8 bg-teal-300' : 'w-3 bg-white/20 hover:bg-white/40'
              }`}
            />
          ))}
        </div>
        <p className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="size-4 text-teal-300" />
          Bank outcomes backed by uploaded MIS. Always.
        </p>
      </div>
    </section>
  );
}

function CardsArt() {
  return (
    <svg viewBox="0 0 360 240" role="img" aria-label="Credit cards illustration" className="w-full">
      <defs>
        <linearGradient id="lc-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#134e4a" />
          <stop offset="1" stopColor="#0f766e" />
        </linearGradient>
        <linearGradient id="lc-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1e2f4d" />
          <stop offset="1" stopColor="#16233c" />
        </linearGradient>
      </defs>
      <circle cx="330" cy="34" r="4" fill="#2dd4bf" opacity="0.7" />
      <circle cx="30" cy="200" r="3" fill="#38bdf8" opacity="0.6" />
      <circle cx="312" cy="196" r="2.5" fill="#2dd4bf" opacity="0.5" />
      <g transform="rotate(9 235 92)">
        <rect x="140" y="30" width="190" height="118" rx="16" fill="url(#lc-back)" />
        <rect x="140" y="52" width="190" height="20" fill="#0b1424" />
        <rect x="156" y="96" width="60" height="10" rx="5" fill="#334155" />
        <rect x="156" y="116" width="96" height="8" rx="4" fill="#26334d" />
      </g>
      <g transform="rotate(-7 140 140)">
        <rect x="30" y="72" width="220" height="138" rx="18" fill="url(#lc-front)" />
        <rect x="30" y="72" width="220" height="138" rx="18" fill="white" opacity="0.04" />
        <rect x="50" y="98" width="38" height="28" rx="6" fill="#fbbf24" />
        <path d="M50 112h38M69 98v28" stroke="#b45309" strokeWidth="1.5" />
        <path
          d="M104 106a10 10 0 0 1 0 12M110 101a16 16 0 0 1 0 22M116 96a22 22 0 0 1 0 32"
          stroke="#5eead4"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        <text x="50" y="164" fill="#ccfbf1" fontSize="15" letterSpacing="3" fontFamily="monospace">
          •••• •••• •••• 4821
        </text>
        <text x="50" y="190" fill="#99f6e4" fontSize="9" letterSpacing="1.5">
          KBS ADVISOR
        </text>
        <circle cx="206" cy="184" r="12" fill="#f87171" opacity="0.9" />
        <circle cx="222" cy="184" r="12" fill="#fbbf24" opacity="0.85" />
      </g>
    </svg>
  );
}

function MisArt() {
  const rows = [
    { ref: 'HDFC-88231', pill: '#34d399', label: 'Approved' },
    { ref: 'HDFC-90217', pill: '#34d399', label: 'Active' },
    { ref: 'HDFC-71104', pill: '#fbbf24', label: 'Review' },
    { ref: 'HDFC-65540', pill: '#f87171', label: 'Declined' },
  ];
  return (
    <svg viewBox="0 0 360 240" role="img" aria-label="MIS matching illustration" className="w-full">
      <defs>
        <linearGradient id="lm-sheet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="1" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <circle cx="34" cy="40" r="3.5" fill="#38bdf8" opacity="0.6" />
      <circle cx="330" cy="200" r="4" fill="#2dd4bf" opacity="0.6" />
      <g transform="rotate(-2 180 130)">
        <rect x="50" y="52" width="260" height="150" rx="14" fill="url(#lm-sheet)" />
        <rect x="50" y="52" width="260" height="30" rx="14" fill="#0f766e" />
        <rect x="50" y="70" width="260" height="12" fill="#0f766e" />
        <circle cx="68" cy="67" r="4" fill="#5eead4" />
        <circle cx="82" cy="67" r="4" fill="#2dd4bf" />
        <circle cx="96" cy="67" r="4" fill="#14b8a6" />
        {rows.map((r, i) => (
          <g key={r.ref} transform={`translate(0 ${i * 28})`}>
            <rect x="62" y="94" width="90" height="9" rx="4.5" fill="#cbd5e1" />
            <text x="62" y="101" fontSize="7" fill="#64748b" fontFamily="monospace">
              {r.ref}
            </text>
            <rect x="170" y="92" width="52" height="13" rx="6.5" fill={r.pill} opacity="0.2" />
            <text x="178" y="101" fontSize="7" fill={r.pill} fontWeight="700">
              {r.label}
            </text>
            <circle cx="284" cy="98" r="7" fill="#0f766e" />
            <path d="M280.5 98l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.6" fill="none" />
          </g>
        ))}
      </g>
      <g transform="rotate(6 296 52)">
        <rect x="262" y="26" width="72" height="52" rx="10" fill="#16233c" />
        <path d="M298 60V40m0 0l-7 7m7-7l7 7" stroke="#2dd4bf" strokeWidth="3" fill="none" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function PayoutArt() {
  return (
    <svg viewBox="0 0 360 240" role="img" aria-label="Payout approval illustration" className="w-full">
      <defs>
        <linearGradient id="lp-wallet" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#134e4a" />
          <stop offset="1" stopColor="#0d9488" />
        </linearGradient>
      </defs>
      <circle cx="40" cy="36" r="3" fill="#2dd4bf" opacity="0.6" />
      <circle cx="324" cy="56" r="4" fill="#fbbf24" opacity="0.7" />
      <rect x="56" y="90" width="170" height="110" rx="16" fill="url(#lp-wallet)" />
      <rect x="56" y="90" width="170" height="34" rx="16" fill="#0b3b36" />
      <rect x="56" y="112" width="170" height="12" fill="#0b3b36" />
      <text x="72" y="112" fill="#5eead4" fontSize="10" letterSpacing="2">
        KBS PAYOUTS
      </text>
      <text x="72" y="162" fill="white" fontSize="26" fontWeight="700" fontFamily="monospace">
        ₹ 1,500
      </text>
      <rect x="72" y="174" width="86" height="14" rx="7" fill="#2dd4bf" opacity="0.25" />
      <text x="80" y="184" fontSize="8" fill="#99f6e4">
        APPROVED
      </text>
      <g>
        {[0, 1, 2].map((i) => (
          <ellipse
            key={i}
            cx={282}
            cy={150 - i * 14}
            rx="34"
            ry="12"
            fill={i === 2 ? '#fbbf24' : '#b45309'}
            stroke="#92400e"
            strokeWidth="1"
          />
        ))}
        <text x="272" y="104" fontSize="13" fill="#78350f" fontWeight="700">
          ₹
        </text>
      </g>
      <g transform="translate(238 176)">
        <rect width="96" height="46" rx="10" fill="#16233c" />
        <circle cx="18" cy="15" r="6" fill="#34d399" />
        <path d="M15.5 15l2 2 3.5-4" stroke="#052e2b" strokeWidth="1.5" fill="none" />
        <rect x="30" y="12" width="52" height="6" rx="3" fill="#475569" />
        <circle cx="18" cy="33" r="6" fill="#34d399" />
        <path d="M15.5 33l2 2 3.5-4" stroke="#052e2b" strokeWidth="1.5" fill="none" />
        <rect x="30" y="30" width="40" height="6" rx="3" fill="#475569" />
      </g>
    </svg>
  );
}

function TeamArt() {
  const people = [
    { cx: 80, cy: 62, fill: '#2dd4bf', label: 'TC' },
    { cx: 288, cy: 66, fill: '#38bdf8', label: 'MG' },
    { cx: 82, cy: 188, fill: '#fbbf24', label: 'AD' },
    { cx: 290, cy: 184, fill: '#f87171', label: 'AD' },
  ];
  return (
    <svg viewBox="0 0 360 240" role="img" aria-label="Team operations illustration" className="w-full">
      <circle cx="180" cy="26" r="3" fill="#2dd4bf" opacity="0.7" />
      <circle cx="330" cy="130" r="3.5" fill="#38bdf8" opacity="0.5" />
      {people.map((p) => (
        <line
          key={p.label + p.cx}
          x1={p.cx}
          y1={p.cy}
          x2="180"
          y2="124"
          stroke="#2dd4bf"
          strokeWidth="1.5"
          strokeDasharray="4 5"
          opacity="0.5"
        />
      ))}
      <rect x="156" y="92" width="48" height="72" rx="10" fill="#16233c" stroke="#2dd4bf" strokeWidth="1.5" />
      <rect x="164" y="104" width="32" height="5" rx="2.5" fill="#2dd4bf" />
      <rect x="164" y="116" width="32" height="5" rx="2.5" fill="#475569" />
      <rect x="164" y="128" width="24" height="5" rx="2.5" fill="#475569" />
      <rect x="164" y="142" width="32" height="10" rx="5" fill="#0f766e" />
      {people.map((p) => (
        <g key={p.label + p.cx}>
          <circle cx={p.cx} cy={p.cy} r="26" fill="#16233c" stroke={p.fill} strokeWidth="2" />
          <circle cx={p.cx} cy={p.cy - 7} r="8" fill={p.fill} opacity="0.9" />
          <path
            d={`M${p.cx - 12} ${p.cy + 14}a12 10 0 0 1 24 0`}
            fill={p.fill}
            opacity="0.7"
          />
          <rect x={p.cx - 14} y={p.cy + 20} width="28" height="12" rx="6" fill="#0c1526" stroke={p.fill} strokeWidth="1" />
          <text x={p.cx - 8} y={p.cy + 29} fontSize="8" fill={p.fill} fontWeight="700">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
