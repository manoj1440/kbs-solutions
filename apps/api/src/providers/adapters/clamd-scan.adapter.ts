import { connect } from 'node:net';

import type { ScanProvider } from '../ports';

/**
 * F-902 ClamAV adapter over the clamd TCP protocol (INSTREAM). REQ-24 §24.4.
 * - `stream: OK` → CLEAN; `stream: <signature> FOUND` → INFECTED (signature kept as detail).
 * - Timeouts, connection errors and `ERROR` replies throw, so the caller keeps the file PENDING (fail closed): a
 *   file the scanner never judged is never reported CLEAN.
 */
export class ClamdScanAdapter implements ScanProvider {
  readonly name = 'clamav';
  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly timeoutMs = 30_000,
    private readonly chunkBytes = 64 * 1024,
  ) {}

  scan(input: { body: Buffer }): Promise<{ status: 'CLEAN' | 'INFECTED' | 'SKIPPED'; detail?: string }> {
    return new Promise((resolve, reject) => {
      const socket = connect({ host: this.host, port: this.port });
      const chunks: Buffer[] = [];
      let settled = false;
      const done = (fn: () => void) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        fn();
      };
      socket.setTimeout(this.timeoutMs, () => done(() => reject(new Error('clamd timeout'))));
      socket.on('error', (e) => done(() => reject(e)));
      socket.on('data', (d) => chunks.push(d));
      socket.on('end', () =>
        done(() => {
          const reply = Buffer.concat(chunks).toString('utf8').replace(/\0/g, '').trim();
          if (/:\s*OK$/.test(reply)) return resolve({ status: 'CLEAN' });
          const found = reply.match(/:\s*(.+)\s+FOUND$/);
          if (found) return resolve({ status: 'INFECTED', detail: found[1] });
          reject(new Error(`clamd: ${reply || 'empty reply'}`));
        }),
      );
      socket.on('connect', () => {
        socket.write('zINSTREAM\0');
        for (let i = 0; i < input.body.length; i += this.chunkBytes) {
          const part = input.body.subarray(i, i + this.chunkBytes);
          const len = Buffer.alloc(4);
          len.writeUInt32BE(part.length, 0);
          socket.write(len);
          socket.write(part);
        }
        socket.write(Buffer.alloc(4)); // zero-length chunk terminates the stream
      });
    });
  }
}
