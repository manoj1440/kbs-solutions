import { apiFetch } from '@/lib/api';

import { CardEditor, type CardDetail } from './card-editor';

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [card, cats] = await Promise.all([apiFetch<CardDetail>(`/catalogue/cards/${id}`), apiFetch<{ key: string; label: string }[]>('/catalogue/categories')]);
  return <CardEditor initial={card.data} categories={cats.data} />;
}
