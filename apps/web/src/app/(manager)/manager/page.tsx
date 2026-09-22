import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ManagerHome() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming next</CardTitle>
          <CardDescription>Create Telecaller, training progress, WFH exceptions and team analytics arrive with F-201, F-205, F-301 and F-702.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">The API endpoints for these already exist; the screens are the next feature files in the roadmap.</CardContent>
      </Card>
    </div>
  );
}
