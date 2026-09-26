'use client';

import { ApiClientError } from '@kbs/shared';
import { Play } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { clientApi } from '@/lib/client-api';

/** F-309 §4: fetches a short-lived playback URL (server logs the sensitive access) and opens it. */
export function PlayRecordingButton({ callId }: { callId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Button
        size="sm"
        variant="soft"
        onClick={async () => {
          try {
            const r = await clientApi.get<{ url: string }>(`/calls/${callId}/recording-url`);
            window.open(r.data.url, '_blank', 'noopener');
          } catch (e) {
            setMsg(e instanceof ApiClientError ? e.message : 'Could not open the recording.');
          }
        }}
      >
        <Play aria-hidden="true" />
        Play
      </Button>
      {msg ? <span className="text-destructive text-xs">{msg}</span> : null}
    </span>
  );
}
