import { cn } from '@/lib/utils';

import { bankGradient } from './ui/kit';

/** F-806: brand-neutral credit-card illustration (deterministic colours per bank code; not the bank's real artwork). */
export function CreditCardArt({ bankCode, bankName, cardName, className, muted }: { bankCode: string; bankName: string; cardName: string; className?: string; muted?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative isolate aspect-[1.586] w-full overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-[0_10px_24px_-12px_rgb(15_23_42/55%)]',
        bankGradient(bankCode),
        muted && 'grayscale-[0.7] opacity-80',
        className,
      )}
    >
      <span className="absolute -top-10 -right-8 -z-10 size-36 rounded-full bg-white/10" />
      <span className="absolute -bottom-16 -left-10 -z-10 size-44 rounded-full bg-black/10" />
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold tracking-wide opacity-90">{bankName}</span>
        <svg viewBox="0 0 24 24" className="size-5 opacity-80" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8.5 8.5a5 5 0 0 1 0 7M12 6a8.5 8.5 0 0 1 0 12M15.5 3.5a12 12 0 0 1 0 17" />
        </svg>
      </div>
      <div className="mt-3 h-6 w-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 ring-1 ring-amber-500/40" />
      <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-2">
        <span className="line-clamp-2 text-[13px] leading-tight font-semibold">{cardName}</span>
        <span className="font-mono text-[10px] tracking-widest opacity-75">•••• 0000</span>
      </div>
    </div>
  );
}
