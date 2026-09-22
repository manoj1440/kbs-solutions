import type { TrainingModuleView } from '@kbs/shared';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

type ModuleRow = TrainingModuleView & { draftQuestionCount?: number };

/** F-202: three modules, each video + MCQ (REQ-05 §5.2). */
export default async function TrainingAdmin() {
  const mods = await apiFetch<ModuleRow[]>('/training/modules');
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Training modules</h1>
        <p className="text-muted-foreground text-sm">Telecallers must pass all three (video + questions) within their 72-hour window. Edits are drafts until you publish.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {mods.data.map((m) => (
          <Link key={m.id} href={`/admin/training/${m.sequence}`}>
            <Card className="h-full transition hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Module {m.sequence}
                  <Badge variant={m.status === 'PUBLISHED' ? 'success' : 'warning'}>{m.status === 'PUBLISHED' ? `v${m.version}` : 'Draft'}</Badge>
                </CardTitle>
                <CardDescription>{m.title}</CardDescription>
              </CardHeader>
              <CardContent className="text-muted-foreground grid gap-1 text-sm">
                <div>{m.questionCount} live questions{m.draftVersion ? ` · ${m.draftQuestionCount ?? 0} in draft v${m.draftVersion}` : ''}</div>
                <div>Pass mark {m.passThresholdPct}%</div>
                <div>{m.videoFileId ? 'Video uploaded' : 'No video yet'}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
