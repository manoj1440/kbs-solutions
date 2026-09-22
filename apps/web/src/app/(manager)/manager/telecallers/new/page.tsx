import { CreateTelecallerForm } from './create-telecaller-form';

export default function NewTelecallerPage() {
  return (
    <div className="grid max-w-lg gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Create Telecaller</h1>
        <p className="text-muted-foreground text-sm">Only a name and mobile number are needed (REQ-05 §5.1). The Telecaller reports to you, gets an employee code and an official ID card, and their 72-hour training window starts at their first login.</p>
      </div>
      <CreateTelecallerForm />
    </div>
  );
}
