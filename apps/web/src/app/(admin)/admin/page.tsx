import { CheckCircle2, CircleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api';

interface LaunchGate {
  key: string;
  description: string;
  isSet: boolean;
}

/** Executive overview placeholder: the REQ-28 §28.2 launch-gate checklist is live from day one (F-104). */
export default async function AdminOverview() {
  const gates = await apiFetch<LaunchGate[]>('/config/launch-gates');
  const unset = gates.data.filter((g) => !g.isSet);
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-muted-foreground text-sm">Dashboards arrive with F-703. Until then, the launch gates below show what KBS must decide before production.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Launch gates
            <Badge variant={unset.length ? 'warning' : 'success'}>{unset.length ? `${unset.length} pending` : 'all set'}</Badge>
          </CardTitle>
          <CardDescription>Configuration values the PRD marks OPEN / REQUIRED BEFORE BUILD. The system fails closed while they are unset.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2">
            {gates.data.map((g) => (
              <li key={g.key} className="flex items-start gap-2 text-sm">
                {g.isSet ? <CheckCircle2 className="text-success mt-0.5 size-4" /> : <CircleAlert className="text-warning mt-0.5 size-4" />}
                <div>
                  <div className="font-mono text-xs">{g.key}</div>
                  <div className="text-muted-foreground">{g.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
