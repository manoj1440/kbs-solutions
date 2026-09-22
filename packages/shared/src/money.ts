/** INR formatting with Indian digit grouping (12,34,567.00). Amounts are strings/decimals, never floats. */
export function formatInr(amount: string | number, opts: { decimals?: number; symbol?: boolean } = {}): string {
  const decimals = opts.decimals ?? 2;
  const n = typeof amount === 'string' ? Number(amount) : amount;
  if (!Number.isFinite(n)) return '—';
  const fixed = Math.abs(n).toFixed(decimals);
  const [intPart, frac] = fixed.split('.');
  const s = intPart as string;
  let grouped: string;
  if (s.length <= 3) grouped = s;
  else {
    const last3 = s.slice(-3);
    const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  const sign = n < 0 ? '-' : '';
  const body = decimals > 0 ? `${grouped}.${frac}` : grouped;
  return `${sign}${opts.symbol === false ? '' : '₹'}${body}`;
}
