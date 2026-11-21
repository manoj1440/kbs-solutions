import ExcelJS from 'exceljs';

import { assertWorkbookSafe, declaredUnzippedBytes, parseWorkbook } from './tabular';

async function workbook(rows: number): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(['Mobile', 'Name']);
  for (let i = 0; i < rows; i++) ws.addRow([`98765${String(i).padStart(5, '0')}`, `Name ${i}`]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('F-908 S10 workbook size guard', () => {
  it('SEC-11: reads the declared unzipped size without inflating and still parses normal workbooks', async () => {
    const body = await workbook(50);
    const unzipped = declaredUnzippedBytes(body);
    expect(unzipped).toBeGreaterThan(body.length);
    expect(Number.isFinite(unzipped)).toBe(true);
    const { sheet } = await parseWorkbook(body);
    expect(sheet.rows).toHaveLength(50);
  });
  it('SEC-11: refuses a workbook that expands past the cap, and an oversized upload; an unreadable size (ZIP64 / non-zip) falls back to the byte cap', async () => {
    const body = await workbook(50);
    expect(() => assertWorkbookSafe(body, { maxUnzippedBytes: 1000 })).toThrow(/expands to more data/);
    expect(() => assertWorkbookSafe(body, { maxBytes: 100 })).toThrow(/at most/);
    expect(declaredUnzippedBytes(Buffer.from('not a zip file at all, just text that is long enough'))).toBeNull();
  });
});
