import * as React from 'react';

import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-slate-400 selection:bg-primary selection:text-primary-foreground h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-base shadow-[inset_0_1px_1px_rgb(15_23_42/3%)] transition-[color,box-shadow,border-color] outline-none hover:border-slate-300 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 md:h-10 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
