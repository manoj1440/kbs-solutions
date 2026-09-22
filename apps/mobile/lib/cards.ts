import type { AvailableCard } from '@kbs/shared';

import { api } from '@/lib/api';

export interface AvailableCardsResponse {
  cards: AvailableCard[];
  message: string | null;
  asOf: string;
  pincode: string;
  location: { state: string | null; district: string | null };
}

/** F-308: cards offered for a calling record's pincode (server enforces scope + gates). */
export const fetchCardsForRecord = (recordId: string) => api.get<AvailableCardsResponse>(`/calling/records/${recordId}/cards`);

/** Short-lived download URL for a stored file (card image / benefit PDF). */
export const fileUrl = async (fileId: string) => (await api.get<{ url: string }>(`/files/${fileId}/url`)).data.url;

export const money = (n: number | null) => (n === null ? '—' : n === 0 ? 'Nil' : `₹${n.toLocaleString('en-IN')}`);
