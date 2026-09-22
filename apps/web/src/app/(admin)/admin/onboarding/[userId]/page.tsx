import { formatDateTime, type OnboardingView } from '@kbs/shared';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

import { ReviewActions } from './review-actions';

type Detail = OnboardingView & { userId: string; profileId: string; bankAccountNumber: string | null };

export default async function OnboardingReviewPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const d = (await apiFetch<Detail>(`/onboarding/review/${userId}`)).data;
  return (
    <div className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{d.personal.fullName || '(no name)'}</h1>
        <Badge variant={d.step === 'AWAITING_REVIEW' ? 'info' : d.step === 'COMPLETE' ? 'success' : 'warning'}>{d.step.replace(/_/g, ' ')}</Badge>
        {d.submittedAt ? <span className="text-muted-foreground text-sm">submitted {formatDateTime(d.submittedAt)}</span> : null}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Provider result only — KBS holds no identity number or document.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p>
            <Badge variant={d.identity.status === 'VERIFIED' ? 'success' : 'destructive'}>{d.identity.status}</Badge> via {d.identity.provider ?? '—'} ({d.identity.method ?? '—'}){d.identity.verifiedAt ? ` on ${formatDateTime(d.identity.verifiedAt)}` : ''}
          </p>
          {d.identity.summary ? <pre className="bg-muted rounded-md p-2 text-xs">{JSON.stringify(d.identity.summary, null, 2)}</pre> : null}
          {d.consent ? (
            <p className="text-muted-foreground text-xs">
              Consent recorded {formatDateTime(d.consent.at)} · privacy notice {d.consent.privacyNoticeVersion}
            </p>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Contact, bank & cheque</CardTitle>
          <CardDescription>Account number masked; reveal is logged as a sensitive access.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <p>Email: {d.personal.email ?? '—'}</p>
          <p>
            Bank: {d.bank?.bankName ?? '—'} · holder {d.bank?.accountHolderName ?? '—'} · ••••{d.bank?.accountLast4 ?? '—'} · IFSC {d.bank?.ifsc ?? '—'}
          </p>
          <p>Reporting to: {d.reportingParent ? `${d.reportingParent.fullName} (${d.reportingParent.role})` : '—'}</p>
          <ReviewActions userId={userId} chequeFileId={d.cheque?.fileId ?? null} chequeName={d.cheque?.originalName ?? null} canDecide={d.step === 'AWAITING_REVIEW'} />
        </CardContent>
      </Card>
    </div>
  );
}
