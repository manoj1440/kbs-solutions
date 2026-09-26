import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/** Soft tinted badges (F-806): tone groups visually, the text always carries the meaning (REQ-20 §20.2). */
const badgeVariants = cva(
  'inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-[11px] leading-5 font-semibold w-fit whitespace-nowrap shrink-0 ring-1 ring-inset [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-[color,box-shadow] overflow-hidden',
  {
    variants: {
      variant: {
        default: 'bg-primary/10 text-primary ring-primary/20',
        secondary: 'bg-slate-100 text-slate-700 ring-slate-200',
        destructive: 'bg-destructive/10 text-destructive ring-destructive/20',
        success: 'bg-success/10 text-success ring-success/25',
        warning: 'bg-warning/10 text-warning ring-warning/25',
        info: 'bg-info/10 text-info ring-info/20',
        unknown: 'bg-unknown/10 text-slate-600 ring-unknown/20',
        outline: 'text-foreground ring-slate-200 bg-white',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'span';
  return <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
