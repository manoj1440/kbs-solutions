import { canonicalContentType, sniff } from './sniff';

describe('content sniffing (REQ-24 §24.4)', () => {
  it('detects common types by magic bytes', () => {
    expect(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]))).toBe('image/png');
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniff(Buffer.from('%PDF-1.7\n'))).toBe('application/pdf');
    expect(sniff(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(8)]))).toBe('video/mp4');
    expect(sniff(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]))).toBe('application/zip');
    expect(sniff(Buffer.from('NAME,PAN NO,MOBILE,Pincode\nA,B,C,302001\n'))).toBe('text/plain');
    expect(sniff(Buffer.from([0x00, 0x01, 0x02, 0xfe, 0x00, 0x00]))).toBe('unknown');
  });
  it('keeps spreadsheet/csv declared types when consistent with the bytes', () => {
    expect(canonicalContentType('application/zip', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toContain('spreadsheetml');
    expect(canonicalContentType('text/plain', 'text/csv')).toBe('text/csv');
    expect(canonicalContentType('application/pdf', 'image/png')).toBe('application/pdf');
  });
});
