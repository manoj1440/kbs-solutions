import { createServer, type Server } from 'node:net';

import { ClamdScanAdapter } from './clamd-scan.adapter';

/** Fake clamd: reads INSTREAM chunks and answers like clamd does. */
function fakeClamd(reply: (body: Buffer) => string | null): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((sock) => {
      let buf = Buffer.alloc(0);
      sock.on('data', (d) => {
        buf = Buffer.concat([buf, d]);
        const cmd = 'zINSTREAM\0';
        if (buf.length < cmd.length) return;
        let off = cmd.length;
        const parts: Buffer[] = [];
        while (off + 4 <= buf.length) {
          const n = buf.readUInt32BE(off);
          if (n === 0) {
            const r = reply(Buffer.concat(parts));
            if (r !== null) sock.end(`${r}\0`);
            return;
          }
          if (off + 4 + n > buf.length) return;
          parts.push(buf.subarray(off + 4, off + 4 + n));
          off += 4 + n;
        }
      });
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as { port: number }).port }));
  });
}

describe('ClamdScanAdapter (F-902, REQ-24 §24.4)', () => {
  const EICAR = Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
  it('CLEAN on OK, INFECTED with signature on FOUND; streams in chunks', async () => {
    const { server, port } = await fakeClamd((b) => (b.includes(Buffer.from('EICAR')) ? 'stream: Win.Test.EICAR_HDB-1 FOUND' : 'stream: OK'));
    const a = new ClamdScanAdapter('127.0.0.1', port, 2000, 7);
    await expect(a.scan({ body: Buffer.from('%PDF-1.7 harmless receipt') })).resolves.toEqual({ status: 'CLEAN' });
    await expect(a.scan({ body: EICAR })).resolves.toEqual({ status: 'INFECTED', detail: 'Win.Test.EICAR_HDB-1' });
    server.close();
  });
  it('fails closed: clamd errors, silence and refused connections throw (never CLEAN)', async () => {
    const err = await fakeClamd(() => 'INSTREAM size limit exceeded. ERROR');
    await expect(new ClamdScanAdapter('127.0.0.1', err.port, 2000).scan({ body: Buffer.from('x') })).rejects.toThrow(/clamd/);
    err.server.close();
    const silent = await fakeClamd(() => null);
    await expect(new ClamdScanAdapter('127.0.0.1', silent.port, 200).scan({ body: Buffer.from('x') })).rejects.toThrow(/timeout/);
    silent.server.close();
    await expect(new ClamdScanAdapter('127.0.0.1', 1, 500).scan({ body: Buffer.from('x') })).rejects.toThrow();
  });
});
