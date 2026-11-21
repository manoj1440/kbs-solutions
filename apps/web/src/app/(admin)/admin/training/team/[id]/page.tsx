import TelecallerTrainingPage from '@/app/(manager)/manager/telecallers/[id]/page';

export const metadata = { title: 'Telecaller training' };

/** Admin read-only view reuses the Manager page; the API omits `canReactivate` for Admin so no button renders. */
export default TelecallerTrainingPage;
