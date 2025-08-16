import { notFound } from "next/navigation";
import DraftEditor from "./DraftEditor";

export default async function DraftPage({ params }: { params: Promise<{ id: string }>}) {
    const { id } = await params;

    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/n8n/campaign/draft/${id}`, {
        method: "GET",
    });

    if (!res.ok) notFound();
    const { draft } = await res.json();
    if (!draft) notFound();



    return <DraftEditor initialDraft={draft} />;
}
