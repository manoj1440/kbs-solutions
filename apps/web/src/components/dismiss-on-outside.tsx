'use client';

import { useEffect } from 'react';

/**
 * One app-wide rule: a click outside closes any open popup.
 * - Native `<dialog>` modals/drawers: a backdrop click lands on the dialog element itself, outside its box → `close()`
 *   (same as Esc, so each dialog's own `onClose` still runs).
 * - `<details data-popover>` dropdowns (account menu, period picker): any press outside an open one closes it.
 *   Plain `<details>` stay inline expanders and are left alone.
 * Radix menus (shadcn dropdown-menu) already dismiss themselves.
 */
export function DismissOnOutside() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const d = e.target;
      if (!(d instanceof HTMLDialogElement) || !d.open) return;
      const r = d.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) d.close();
    };
    const onPointerDown = (e: PointerEvent) => {
      for (const el of document.querySelectorAll<HTMLDetailsElement>('details[data-popover][open]')) {
        if (!el.contains(e.target as Node)) el.open = false;
      }
    };
    document.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);
  return null;
}
