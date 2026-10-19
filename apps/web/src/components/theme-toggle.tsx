'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

/** F-817 dark mode. The choice lives in the `kbs_theme` cookie; the root layout's inline script applies it before paint. */
export type Theme = 'light' | 'dark' | 'system';
export const THEME_COOKIE = 'kbs_theme';

const prefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark()));
  root.dataset.theme = theme;
}

function persist(theme: Theme) {
  apply(theme);
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=31536000; samesite=lax`;
}

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Light / Dark / System. `vertical` = icons stacked (collapsed sidebar); otherwise a labelled segmented control. */
export function ThemeToggle({ initial, vertical = false, className }: { initial: Theme; vertical?: boolean; className?: string }) {
  const [theme, setTheme] = useState<Theme>(initial);
  // follow the OS while on "System"
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => apply('system');
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [theme]);
  function choose(next: Theme) {
    setTheme(next);
    persist(next);
  }
  return (
    <div role="radiogroup" aria-label="Theme" className={cn('glass-tile flex gap-0.5 rounded-full p-1', vertical ? 'flex-col items-center' : 'w-full', className)}>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={() => choose(value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              vertical ? 'size-8' : 'h-8 flex-1',
              on ? 'bg-foreground text-background' : 'text-fg-3 hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            {vertical ? null : label}
          </button>
        );
      })}
    </div>
  );
}
