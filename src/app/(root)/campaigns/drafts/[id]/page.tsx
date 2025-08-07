// app/campaign/drafts/[id]/page.tsx
import { notFound } from "next/navigation";
import DraftEditor from "./DraftEditor";

export default async function Page({ params }: { params: Promise<{ id: string }>}) {
    const { id } = await params;

    // Server-side fetch so the page is hydrated with data immediately
    // (Relative fetch works in Next app routes; disable cache for freshness)
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/n8n/campaign/draft/${id}`, {
        cache: "no-store"
    });

    if (!res.ok) notFound();
    const { draft } = await res.json();
    if (!draft) notFound();

    return <DraftEditor initialDraft={draft} />;
}
