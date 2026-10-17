import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// F-814: custom tokens tailwind-merge must classify correctly, or `text-ui` is mistaken for a colour and dropped when
// a later `text-white` arrives (and `shadow-card` vs `shadow-sm` would both survive).
const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: ['2xs', 'ui'], shadow: ['card', 'pop'] },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
