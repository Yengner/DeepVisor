import { redirect } from 'next/navigation';

// Legacy route: the smart campaign builder was retired. Kept as a redirect because saved
// links may still point here.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { draft } = await searchParams;
  redirect(typeof draft === 'string' && draft ? `/campaigns/create?draft=${encodeURIComponent(draft)}` : '/campaigns/create');
}
