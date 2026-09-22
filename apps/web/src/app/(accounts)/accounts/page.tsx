import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountsHome() {
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <Card>
        <CardHeader>
          <CardTitle>Awaiting payment</CardTitle>
          <CardDescription>Only requests approved by both the Manager and the Admin appear here (F-605). Nothing in this app moves money.</CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">Queue arrives with F-605.</CardContent>
      </Card>
    </div>
  );
}
