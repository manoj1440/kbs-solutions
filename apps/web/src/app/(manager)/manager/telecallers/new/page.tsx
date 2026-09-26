import { UserPlus } from 'lucide-react';

import { PageHeader } from '@/components/ui/kit';

import { CreateTelecallerForm } from './create-telecaller-form';

export default function NewTelecallerPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <PageHeader
        icon={UserPlus}
        tone="violet"
        eyebrow="Team"
        title="Create Telecaller"
        description="Only a name and mobile number are needed (REQ-05 §5.1). The Telecaller reports to you, gets an employee code and an official ID card, and their 72-hour training window starts at their first login."
      />
      <CreateTelecallerForm />
    </div>
  );
}
