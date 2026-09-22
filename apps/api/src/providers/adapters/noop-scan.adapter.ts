import type { ScanProvider } from '../ports';

/** No scanner configured: files are marked SKIPPED, never CLEAN (REQ-24 §24.4). */
export class NoopScanAdapter implements ScanProvider {
  readonly name = 'noop';
  async scan() {
    return { status: 'SKIPPED' as const, detail: 'no scanner configured' };
  }
}
