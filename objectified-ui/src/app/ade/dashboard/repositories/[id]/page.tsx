import { redirect } from 'next/navigation';

/** Canonical repository UI lives under `preview/` (Repository Store mockup: repository.html). */
export default async function RepositoryIdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/ade/dashboard/repositories/${id}/preview`);
}
