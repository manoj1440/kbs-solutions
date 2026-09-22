import { apiFetch } from '@/lib/api';

import { CardEditor, type CardDetail, type Publication } from './card-editor';

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, cats, pubs] = await Promise.all([apiFetch<CardDetail>(`/catalogue/cards/${id}`), apiFetch<{ key: string; label: string }[]>('/catalogue/categories'), apiFetch<Publication[]>(`/catalogue/cards/${id}/publications`)]);
  return <CardEditor initial={card.data} categories={cats.data} initialPublications={pubs.data} />;
}
