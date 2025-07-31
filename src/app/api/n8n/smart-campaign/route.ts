

export async function POST(req: Request) {
    const requestBody = await req.json();
    console.log('Received request body:', requestBody);
    // const creativeBuilder = {
    //     LEAD_FORM: ({ pageId, link, image, formId, msg }: { pageId: string; link: string; image: string; formId: string; msg: string; }) => ({
    //         object_story_spec: {
    //             page_id: pageId,
    //             link_data: {
    //                 message: msg,
    //                 link,
    //                 image_hash: image,
    //                 call_to_action: {
    //                     type: 'LEARN_MORE',
    //                     value: { lead_gen_form_id: formId },
    //                 },
    //             },
    //         },
    //     }),

    //     WHATSAPP: ({ pageId, waLink, msg }: { pageId: string; waLink: string; msg: string; }) => ({
    //         object_story_spec: {
    //             page_id: pageId,
    //             link_data: {
    //                 message: msg,
    //                 link: waLink,
    //                 call_to_action: { type: 'MESSAGE_WHATSAPP' },
    //             },
    //         },
    //     }),

    //     MESSENGER: ({ pageId, mLink, msg }: { pageId: string; mLink: string; msg: string; }) => ({
    //         object_story_spec: {
    //             page_id: pageId,
    //             link_data: {
    //                 message: msg,
    //                 link: mLink,
    //                 call_to_action: { type: 'SEND_MESSAGE' },
    //             },
    //         },
    //     }),

    //     MULTI_DESTINATION: ({ pageId, waLink, mLink, msg }: { pageId: string; waLink: string; mLink: string; msg: string; }) => ({
    //         object_story_spec: {
    //             page_id: pageId,
    //             link_data: {
    //                 message: msg,
    //                 multi_destination_spec: { whatsapp_link: waLink, messenger_link: mLink },
    //                 call_to_action: { type: 'MULTI_DESTINATION' },
    //             },
    //         },
    //     }),
    // };

    // const builder = creativeBuilder[requestBody.destinationType];
    // const creativePayload = builder({
    //     pageId: '',
    //     link: '',
    //     image: '',
    //     formId: '',
    //     msg: '',
    //     waLink: '',
    //     mLink: '',
    // })
    const response = await fetch('https://n8n.deepvisor.com/webhook-test/deepvisor-n8n-automation', { method: 'POST', body: JSON.stringify({ requestBody }) });
    console.log('Response from n8n:', response.status, await response.text());
    return new Response(null, { status: response.status });
}