import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type PropsWithChildren } from 'react';
import { Pressable, Text as RNText, TextInput, View, type PressableProps, type TextInputProps, type TextProps, type ViewProps } from 'react-native';

/**
 * F-802 base components: shadcn-style primitives for React Native on NativeWind + shared tokens (ADR-003).
 * When network access allows, `npx @react-native-reusables/cli add …` can replace these with the registry versions.
 */

export function Screen({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <View className={`flex-1 bg-background px-4 pt-6 ${className ?? ''}`}>{children}</View>;
}

export function Text({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={`text-base text-foreground ${className ?? ''}`} {...props} />;
}

export function Heading({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={`text-2xl font-semibold text-foreground ${className ?? ''}`} {...props} />;
}

export function Muted({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={`text-sm text-muted-foreground ${className ?? ''}`} {...props} />;
}

const buttonVariants = cva('h-12 flex-row items-center justify-center rounded-md px-4 active:opacity-80', {
  variants: {
    variant: {
      default: 'bg-primary',
      secondary: 'bg-secondary',
      outline: 'border border-border bg-background',
      destructive: 'bg-destructive',
      ghost: '',
    },
  },
  defaultVariants: { variant: 'default' },
});
const buttonTextVariants = cva('text-base font-medium', {
  variants: {
    variant: { default: 'text-primary-foreground', secondary: 'text-secondary-foreground', outline: 'text-foreground', destructive: 'text-destructive-foreground', ghost: 'text-primary' },
  },
  defaultVariants: { variant: 'default' },
});

export function Button({ title, variant, className, disabled, ...props }: PressableProps & VariantProps<typeof buttonVariants> & { title: string; className?: string }) {
  return (
    <Pressable accessibilityRole="button" disabled={disabled} className={`${buttonVariants({ variant })} ${disabled ? 'opacity-50' : ''} ${className ?? ''}`} {...props}>
      <RNText className={buttonTextVariants({ variant })}>{title}</RNText>
    </Pressable>
  );
}

export const Input = forwardRef<TextInput, TextInputProps & { className?: string }>(function Input({ className, ...props }, ref) {
  return <TextInput ref={ref} placeholderTextColor="#6b7280" className={`h-12 rounded-md border border-input bg-background px-3 text-base text-foreground ${className ?? ''}`} {...props} />;
});

export function Label({ className, ...props }: TextProps & { className?: string }) {
  return <RNText className={`mb-1 text-sm font-medium text-foreground ${className ?? ''}`} {...props} />;
}

export function Card({ className, ...props }: ViewProps & { className?: string }) {
  return <View className={`rounded-xl border border-border bg-card p-4 ${className ?? ''}`} {...props} />;
}

const badgeVariants = cva('self-start rounded-md px-2 py-0.5', {
  variants: {
    variant: { default: 'bg-primary', secondary: 'bg-secondary', success: 'bg-success', warning: 'bg-warning', destructive: 'bg-destructive', info: 'bg-info', unknown: 'bg-unknown' },
  },
  defaultVariants: { variant: 'default' },
});
const badgeText = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      secondary: 'text-secondary-foreground',
      success: 'text-success-foreground',
      warning: 'text-warning-foreground',
      destructive: 'text-destructive-foreground',
      info: 'text-info-foreground',
      unknown: 'text-unknown-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
});
export function Badge({ label, variant }: { label: string } & VariantProps<typeof badgeVariants>) {
  return (
    <View className={badgeVariants({ variant })}>
      <RNText className={badgeText({ variant })}>{label}</RNText>
    </View>
  );
}

export function ErrorText({ children }: PropsWithChildren) {
  if (!children) return null;
  return (
    <RNText accessibilityRole="alert" className="text-sm text-destructive">
      {children}
    </RNText>
  );
}
