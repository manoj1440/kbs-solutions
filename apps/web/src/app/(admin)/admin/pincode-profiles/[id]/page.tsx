import { apiFetch } from '@/lib/api';

import { ProfileEditor, type ProfileDetail } from './profile-editor';

export default async function PincodeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await apiFetch<ProfileDetail>(`/pincode-profiles/${id}`);
  return <ProfileEditor initial={p.data} />;
}
