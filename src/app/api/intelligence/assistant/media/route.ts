import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { unstable_rethrow } from 'next/navigation';
import { authorizeAssistant, AssistantError } from '@/lib/server/intelligence/assistant/access';
import { claimTurn, finishTurn, releaseTurn, loadConversation } from '@/lib/server/intelligence/assistant/persistence';
import { MEDIA_BUCKET, MAX_MEDIA_BYTES, validateMedia } from '@/lib/server/intelligence/assistant/media';
import { getCampaignDraftById, readCampaignDraftPayload } from '@/lib/server/campaigns/drafts';
export const runtime = 'nodejs';
function failed(error: unknown) { unstable_rethrow(error); return NextResponse.json({ success: false, error: error instanceof AssistantError ? error.message : 'Draft media is unavailable.' }, { status: error instanceof AssistantError ? error.status : 503 }); }
export async function POST(request: NextRequest) {
    try {
        if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin)
            throw new AssistantError('Invalid request origin.', 403);
        // Require a bounded multipart body; do not buffer unbounded requests.
        const length = Number(request.headers.get('content-length'));
        if (!Number.isFinite(length) || length <= 0 || length > MAX_MEDIA_BYTES + 16384)
            throw new AssistantError('Choose a file up to 4 MB.', 413);
        const scope = await authorizeAssistant();
        const form = await request.formData();
        const account = z.string().uuid().parse(form.get('adAccountId'));
        if (account !== scope.account.id)
            throw new AssistantError('Account selection changed.', 409);
        const revision = z.coerce.number().int().nonnegative().parse(form.get('revision'));
        const file = form.get('file');
        if (!(file instanceof File))
            throw new AssistantError('Choose a file first.');
        const bytes = new Uint8Array(await file.arrayBuffer()), mime = validateMedia(bytes, file.type);
        const turn = await claimTurn(scope, revision, 0);
        const id = randomUUID(), path = `${scope.businessId}/${scope.account.id}/${scope.userId}/${turn.id}/${id}`;
        let uploaded = false, finished = false;
        try {
            const attachments = turn.state.attachments ?? [];
            if (attachments.length >= 4)
                throw new AssistantError('Up to four files can be attached to a conversation.');
            const { error } = await scope.db.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
            if (error)
                throw new AssistantError('Private draft storage is unavailable.', 503);
            uploaded = true;
            const name = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '').slice(0, 120) || 'Draft media';
            const state = await finishTurn(scope, turn, { ...turn.state, savedDraftId: null, attachments: [...attachments, { id, name, mime, path }] });
            finished = true;
            return NextResponse.json({ success: true, state });
        }
        finally {
            if (!finished) {
                if (uploaded)
                    await scope.db.storage.from(MEDIA_BUCKET).remove([path]);
                await releaseTurn(scope, turn);
            }
        }
    }
    catch (error) {
        return failed(error);
    }
}
export async function GET(request: NextRequest) {
    try {
        const id = z.string().uuid().parse(request.nextUrl.searchParams.get('id'));
        const scope = await authorizeAssistant(request.nextUrl.searchParams.get('account') ?? undefined);
        const draftId = request.nextUrl.searchParams.get('draft');
        let attachments = (await loadConversation(scope)).attachments ?? [];
        if (draftId) {
            const draft = await getCampaignDraftById(scope.db, { businessId: scope.businessId, draftId: z.string().uuid().parse(draftId) });
            if (!draft || draft.ad_account_id !== scope.account.id || draft.created_by_user_id !== scope.userId)
                throw new AssistantError('Draft media not found.', 404);
            const payload = readCampaignDraftPayload(draft);
            attachments = payload?.mode === 'manual' ? payload.form.assistantMedia ?? [] : [];
        }
        const media = attachments.find(a => a.id === id);
        const prefix = `${scope.businessId}/${scope.account.id}/${scope.userId}/`;
        if (!media || !media.path.startsWith(prefix) || media.path.includes('..'))
            throw new AssistantError('Draft media not found.', 404);
        const { data, error } = await scope.db.storage.from(MEDIA_BUCKET).download(media.path);
        if (error || !data)
            throw new AssistantError('Draft media is unavailable.', 404);
        const mime = validateMedia(new Uint8Array(await data.arrayBuffer()), data.type);
        return new NextResponse(data, { headers: { 'Content-Type': mime, 'Content-Disposition': `inline; filename="draft-${id}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Security-Policy': "default-src 'none'; sandbox" } });
    }
    catch (error) {
        return failed(error);
    }
}
