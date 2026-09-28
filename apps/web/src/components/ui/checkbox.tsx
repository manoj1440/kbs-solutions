'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check, Minus } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-[5px] border border-slate-300 bg-white shadow-[inset_0_1px_1px_rgb(15_23_42/3%)] transition-colors outline-none hover:border-slate-400 focus-visible:border-ring focus-visible:ring-ring/25 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-teal-700 data-[state=checked]:bg-teal-700 data-[state=indeterminate]:border-teal-700 data-[state=indeterminate]:bg-teal-700 data-[state=checked]:text-white data-[state=indeterminate]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {props.checked === 'indeterminate' ? <Minus className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
