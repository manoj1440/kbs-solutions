import { formatDate } from '@kbs/shared';
import { BadgeCheck, SearchX, ShieldX, WifiOff } from 'lucide-react';

import { StatusScreen } from '@/components/status-screen';
import { Badge } from '@/components/ui/badge';
import { humanize } from '@/components/ui/kit';
import { API_URL } from '@/lib/api';

export const metadata = { title: 'ID verification' };

type Verify = { valid: true; fullName: string; employeeCode: string | null; role: string; issuedAt: string; version: number } | { valid: false; reason: 'NOT_FOUND' | 'REVOKED'; fullName?: string; employeeCode?: string | null; revokedAt?: string | null };

/**
 * F-908 P4: a 404 means no such ID; rate limits (429), server errors and network failures mean "try again" — never a
 * crash or a false "not found".
 */
async function lookup(ref: string): Promise<Verify | 'UNAVAILABLE'> {
  try {
    const res = await fetch(`${API_URL}/verify/${encodeURIComponent(ref)}`, { cache: 'no-store' });
    if (res.status === 404) return { valid: false, reason: 'NOT_FOUND' };
    if (!res.ok) return 'UNAVAILABLE';
    const body = (await res.json()) as { data?: Verify };
    return body.data ?? 'UNAVAILABLE';
  } catch {
    return 'UNAVAILABLE';
  }
}

/** F-312: public ID verification — shows name, code and validity only (REQ-08 §8.4). */
export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const v = await lookup(ref);
  if (v === 'UNAVAILABLE') {
    return (
      <StatusScreen icon={WifiOff} tone="slate" role="alert" title="KBS Solutions ID verification" footer="KBS Solutions never asks for payments or OTPs through its representatives.">
        <p className="font-mono text-xs">Reference {ref}</p>
        <p>We could not check this ID right now. Wait a minute, then reload this page to try again.</p>
      </StatusScreen>
    );
  }
  return (
    <StatusScreen
      icon={v.valid ? BadgeCheck : v.reason === 'REVOKED' ? ShieldX : SearchX}
      tone={v.valid ? 'emerald' : v.reason === 'REVOKED' ? 'rose' : 'slate'}
      title="KBS Solutions ID verification"
      footer="KBS Solutions never asks for payments or OTPs through its representatives."
    >
      <p className="font-mono text-xs">Reference {ref}</p>
      {v.valid ? (
        <div className="grid justify-items-center gap-1.5">
          <Badge variant="success">Valid</Badge>
          <p className="text-lg font-semibold text-foreground">{v.fullName}</p>
          <p className="text-fg-2">
            {humanize(v.role)}
            {v.employeeCode ? ` · ${v.employeeCode}` : ''}
          </p>
          <p>
            Issued {formatDate(v.issuedAt)} · card v{v.version}
          </p>
        </div>
      ) : v.reason === 'REVOKED' ? (
        <div className="grid justify-items-center gap-1.5">
          <Badge variant="destructive">Revoked</Badge>
          <p className="text-lg font-semibold text-foreground">{v.fullName}</p>
          <p>This ID is no longer valid{v.revokedAt ? ` (since ${formatDate(v.revokedAt)})` : ''}. Please do not rely on it.</p>
        </div>
      ) : (
        <div className="grid justify-items-center gap-1.5">
          <Badge variant="unknown">Not found</Badge>
          <p>No KBS Solutions ID matches this reference.</p>
        </div>
      )}
    </StatusScreen>
  );
}
