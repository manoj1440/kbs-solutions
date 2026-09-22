/**
 * Minimal bank-date parser (REQ-13 §13.8): tries the profile's formats in order, interprets naive times in the profile
 * timezone (IST offset when Asia/Kolkata), and returns null (never throws) when nothing matches. The original text is
 * always kept next to the parsed value by the caller.
 */
const TZ_OFFSET_MIN: Record<string, number> = { 'Asia/Kolkata': 330, UTC: 0 };

function build(parts: Record<string, number>, tz: string): Date | null {
  const y = parts.yyyy ?? parts.yy;
  const M = parts.MM;
  const d = parts.dd;
  if (!y || !M || !d) return null;
  const H = parts.HH ?? 0;
  const m = parts.mm ?? 0;
  const s = parts.ss ?? 0;
  const ms = Date.UTC(y < 100 ? 2000 + y : y, M - 1, d, H, m, s) - (TZ_OFFSET_MIN[tz] ?? 330) * 60_000;
  const out = new Date(ms);
  return Number.isNaN(out.getTime()) ? null : out;
}

const TOKEN = /yyyy|yy|MMM|MM|dd|HH|hh|mm|ss|a/g;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

function tryFormat(text: string, fmt: string, tz: string): Date | null {
  const keys: string[] = [];
  const re = new RegExp(
    '^' +
      fmt
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(TOKEN, (t) => {
          keys.push(t);
          if (t === 'MMM') return '([A-Za-z]{3})';
          if (t === 'a') return '(AM|PM|am|pm)';
          return t.length === 4 ? '(\\d{4})' : '(\\d{1,2})';
        }) +
      '$',
  );
  const m = re.exec(text);
  if (!m) return null;
  const parts: Record<string, number> = {};
  let pm: boolean | null = null;
  keys.forEach((k, i) => {
    const v = m[i + 1] as string;
    if (k === 'MMM') parts.MM = MONTHS.indexOf(v.toLowerCase()) + 1;
    else if (k === 'a') pm = v.toLowerCase() === 'pm';
    else if (k === 'hh') parts.HH = Number(v);
    else parts[k] = Number(v);
  });
  if (pm !== null && parts.HH !== undefined) parts.HH = (parts.HH % 12) + (pm ? 12 : 0);
  return build(parts, tz);
}

export function parseBankDate(text: string | null | undefined, formats: string[], tz = 'Asia/Kolkata'): Date | null {
  if (!text) return null;
  const t = text.trim();
  if (!t) return null;
  // ISO from exceljs date cells
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(t)) return new Date(t);
  for (const f of formats) {
    const d = tryFormat(t, f, tz);
    if (d) return d;
  }
  return null;
}
