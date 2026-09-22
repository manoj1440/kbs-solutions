import { formatDate } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/api';

type Verify = { valid: true; fullName: string; employeeCode: string | null; role: string; issuedAt: string; version: number } | { valid: false; reason: 'NOT_FOUND' | 'REVOKED'; fullName?: string; employeeCode?: string | null; revokedAt?: string | null };

/** F-312: public ID verification — shows name, code and validity only (REQ-08 §8.4). */
export default async function VerifyPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const res = await fetch(`${API_URL}/verify/${encodeURIComponent(ref)}`, { cache: 'no-store' });
  const v = (await res.json()).data as Verify;
  return (
    <main className="mx-auto grid max-w-md gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>KBS Solutions — ID verification</CardTitle>
          <CardDescription>Reference {ref}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          {v.valid ? (
            <>
              <Badge variant="success">Valid</Badge>
              <p className="text-lg font-semibold">{v.fullName}</p>
              <p>
                {v.role}
                {v.employeeCode ? ` · ${v.employeeCode}` : ''}
              </p>
              <p className="text-muted-foreground">
                Issued {formatDate(v.issuedAt)} · card v{v.version}
              </p>
            </>
          ) : v.reason === 'REVOKED' ? (
            <>
              <Badge variant="destructive">Revoked</Badge>
              <p className="text-lg font-semibold">{v.fullName}</p>
              <p className="text-muted-foreground">This ID is no longer valid{v.revokedAt ? ` (since ${formatDate(v.revokedAt)})` : ''}. Please do not rely on it.</p>
            </>
          ) : (
            <>
              <Badge variant="unknown">Not found</Badge>
              <p className="text-muted-foreground">No KBS Solutions ID matches this reference.</p>
            </>
          )}
          <p className="text-muted-foreground text-xs">KBS Solutions never asks for payments or OTPs through its representatives.</p>
        </CardContent>
      </Card>
    </main>
  );
}
