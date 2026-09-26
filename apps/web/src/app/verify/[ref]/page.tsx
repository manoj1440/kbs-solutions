import { formatDate } from '@kbs/shared';
import { BadgeCheck, SearchX, ShieldX } from 'lucide-react';

import { StatusScreen } from '@/components/status-screen';
import { Badge } from '@/components/ui/badge';
import { humanize } from '@/components/ui/kit';
import { API_URL } from '@/lib/api';

type Verify = { valid: true; fullName: string; employeeCode: string | null; role: string; issuedAt: string; version: number } | { valid: false; reason: 'NOT_FOUND' | 'REVOKED'; fullName?: string; employeeCode?: string | null; revokedAt?: string | null };

/** F-312: public ID verification — shows name, code and validity only (REQ-08 §8.4). */
export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const res = await fetch(`${API_URL}/verify/${encodeURIComponent(ref)}`, { cache: 'no-store' });
  const v = (await res.json()).data as Verify;
  return (
    <StatusScreen
      icon={v.valid ? BadgeCheck : v.reason === 'REVOKED' ? ShieldX : SearchX}
      tone={v.valid ? 'emerald' : v.reason === 'REVOKED' ? 'rose' : 'slate'}
      title="KBS Solutions — ID verification"
      footer="KBS Solutions never asks for payments or OTPs through its representatives."
    >
      <p className="font-mono text-xs">Reference {ref}</p>
      {v.valid ? (
        <div className="grid justify-items-center gap-1.5">
          <Badge variant="success">Valid</Badge>
          <p className="text-lg font-semibold text-slate-900">{v.fullName}</p>
          <p className="text-slate-700">
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
          <p className="text-lg font-semibold text-slate-900">{v.fullName}</p>
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
