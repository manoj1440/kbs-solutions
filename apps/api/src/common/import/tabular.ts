import { parse } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

/** A parsed sheet: exact headers as written and every cell as text (leading zeros preserved — REQ-07 §7.3). */
export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Array<Record<string, string>>; // header → text
}

export function cellToText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toPrecision(15).replace(/\.?0+$/, '');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v && typeof v.text === 'string') return v.text;
    if ('result' in v) return cellToText(v.result as ExcelJS.CellValue);
    if ('error' in v) return String(v.error);
  }
  return String(v);
}

export async function parseWorkbook(body: Buffer, opts: { sheetName?: string; maxRows?: number } = {}): Promise<{ sheets: string[]; sheet: ParsedSheet }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(body as unknown as ArrayBuffer);
  const names = wb.worksheets.map((w) => w.name);
  const ws = opts.sheetName ? wb.getWorksheet(opts.sheetName) : wb.worksheets[0];
  if (!ws) throw new Error(`Sheet not found: ${opts.sheetName ?? '(first)'}`);
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = cellToText(cell.value).trim();
  });
  const rows: Array<Record<string, string>> = [];
  const max = opts.maxRows ?? Number.MAX_SAFE_INTEGER;
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= max) return;
    const rec: Record<string, string> = {};
    let any = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const text = cellToText(row.getCell(i + 1).value).trim();
      rec[h] = text;
      if (text) any = true;
    });
    if (any) rows.push(rec);
  });
  return { sheets: names, sheet: { name: ws.name, headers: headers.filter(Boolean), rows } };
}

export function parseCsv(body: Buffer, opts: { maxRows?: number } = {}): ParsedSheet {
  const records = parse(body, { columns: true, skip_empty_lines: true, bom: true, trim: true, relax_column_count: true, to: opts.maxRows }) as Array<Record<string, string>>;
  const headers = records.length ? Object.keys(records[0] as object) : (parse(body, { to_line: 1, bom: true, trim: true })[0] as string[]) ?? [];
  return { name: 'csv', headers, rows: records.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '').trim()]))) };
}

export async function parseTabular(body: Buffer, contentType: string, opts: { sheetName?: string; maxRows?: number } = {}) {
  if (/spreadsheetml|zip|xlsx/.test(contentType)) return parseWorkbook(body, opts);
  return { sheets: ['csv'], sheet: parseCsv(body, opts) };
}

/** Tolerant header lookup: exact first, then case/space-insensitive. Returns the exact header found. */
export function findHeader(headers: string[], candidates: string[]): string | null {
  for (const c of candidates) if (headers.includes(c)) return c;
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const c of candidates) {
    const hit = headers.find((h) => norm(h) === norm(c));
    if (hit) return hit;
  }
  return null;
}
