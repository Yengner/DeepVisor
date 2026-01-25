import { getAccessToken } from "@/lib/actions/common/accessToken";
import { createSupabaseClient } from "@/lib/utils/supabase/clients/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
    const supabase = await createSupabaseClient();
    const requestBody = await req.json();
    console.log('Received request body:', requestBody);

    // Just retrieve PageId form here until i send it through frontend
    // const pageId = requestBody.pageId;
    const pageId = '352168868872363'; // HARD CODED FOR TESTING
    const adAccountId = requestBody.adAccountId
    const accessToken = await getAccessToken(requestBody.platformId);
    const actionTypes = ['APPLY_NOW', 'DOWNLOAD', 'GET_QUOTE', 'LEARN_MORE', 'SIGN_UP', 'SUBSCRIBE'];

    // ---- Basic normalization 
    const destinationType = String(requestBody.destinationType || 'ON_AD');
    const objective = String(requestBody.objective || 'OUTCOME_LEADS');
    const budget = Number(requestBody.budget || 0);
    const budgetType = String(requestBody.budgetType || 'daily');
    const timeframe = Number(requestBody.timeframe || 30);

    // Optional creative fields from client
    const link = requestBody.link || 'https://fb.me/';
    const message = requestBody.message || '';
    const imageHash = requestBody.imageHash || '';
    const formId = requestBody.formId || '';
    const waLink = requestBody.waLink || '';
    const mLink = requestBody.mLink || '';
    const igLink = requestBody.igLink || '';
    const phoneNumber = requestBody.phoneNumber || '';
    const creativeBuilder = {
        ON_AD: ({ pageId, link, image, formId, msg, description, type }: {
            pageId: string; link: string; image?: string; formId?: string; msg?: string; description?: string; type?: string;
        }) => ({
            object_story_spec: {
                page_id: pageId,
                link_data: {
                    message: msg,
                    link,
                    image_hash: image || undefined,
                    call_to_action: {
                        type: type || 'LEARN_MORE',
                        value: formId ? { lead_gen_form_id: formId } : {}
                    },
                    description: description || undefined
                }
            }
        }),
        WHATSAPP: ({ pageId, waLink, msg }: { pageId: string; waLink?: string; msg?: string }) => ({
            object_story_spec: {
                page_id: pageId,
                link_data: {
                    message: msg,
                    link: waLink || link,
                    call_to_action: { type: 'MESSAGE_WHATSAPP' }
                }
            }
        }),
        MESSENGER: ({ pageId, mLink, msg }: { pageId: string; mLink?: string; msg?: string }) => ({
            object_story_spec: {
                page_id: pageId,
                link_data: {
                    message: msg,
                    link: mLink || link,
                    call_to_action: { type: 'SEND_MESSAGE' }
                }
            }
        }),
        MULTI_DESTINATION: ({ pageId, waLink, mLink, msg }: { pageId: string; waLink?: string; mLink?: string; msg?: string }) => ({
            object_story_spec: {
                page_id: pageId,
                link_data: {
                    message: msg,
                    multi_destination_spec: {
                        whatsapp_link: waLink || undefined,
                        messenger_link: mLink || undefined
                    },
                    call_to_action: { type: 'MULTI_DESTINATION' }
                }
            }
        }),
        LEAD_FROM_IG_DIRECT: ({ pageId, igLink, msg }: { pageId: string; igLink?: string; msg?: string }) => ({
            object_story_spec: {
                page_id: pageId,
                link_data: {
                    message: msg,
                    link: igLink || link,
                    call_to_action: { type: 'INSTAGRAM_DIRECT' }
                }
            }
        }),
        PHONE_CALL: ({ pageId, phoneNumber, msg }: { pageId: string; phoneNumber?: string; msg?: string }) => ({
            object_story_spec: {
                page_id: pageId,
                link_data: {
                    message: msg,
                    call_to_action: { type: 'CALL', value: phoneNumber ? { phone_number: phoneNumber } : {} }
                }
            }
        }),
    } as const;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let creativePayload: any = {};
    if (destinationType in creativeBuilder) {
        creativePayload = (creativeBuilder as any)[destinationType]({ // eslint-disable-line @typescript-eslint/no-explicit-any
            pageId,
            link,
            image: imageHash,
            formId,
            msg: message,
            waLink,
            mLink,
            igLink,
            phoneNumber
        });
    }
    const draftId = crypto.randomUUID();
    const jobId = crypto.randomUUID();

    // Create the Job (queued)
    const { error } = await supabase
        .from("jobs")
        .insert({
            id: jobId,
            user_id: requestBody.userId,
            type: "campaign_draft",
            status: "queued",
            percent: 0,
            step: "init",
            meta: {
                adAccountId: adAccountId,
                objective: objective,
                destinationType: destinationType
            }
        })
        .select()
        .single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

    // Prepare payload for n8n
    const payloadToN8n = {
        jobId,
        draftId,
        userId: String(requestBody.userId || ''),
        platformId: String(requestBody.platformId || ''),
        adAccountId,
        pageId,
        objective,
        destinationType,
        accessToken,
        budget,
        budgetType,
        timeframe,
        creativePayload,
        availableActionTypes: actionTypes,
    };

    console.log('Creative payload:', creativePayload);
    // Send both the requestBody and the creativePayload shell to n8n
    const response = await fetch('https://n8n.deepvisor.com/webhook-test/deepvisor-n8n-automation', {
        method: 'POST',
        body: JSON.stringify(payloadToN8n),
    });

    const text = await response.text();
    console.log('Response from n8n:', response.status, text);

    if (!response.ok) {
        return new Response(JSON.stringify({ ok: false, error: 'n8n_failed', details: text }), {
            status: 502,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ ok: true, jobId, draftId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}