import { DESTINATION_TYPES } from "./objectiveMappings";

export function getDestinationConfig(destinationType: string): { label: string, description: string } {
    switch (destinationType) {
        case DESTINATION_TYPES.FORM:
            return {
                label: 'Instant forms',
                description: 'Generate leads by asking people to fill out a form.'
            };
        // case DESTINATION_TYPES.WEBSITE:
        //     return {
        //         label: 'Website',
        //         description: 'Send users to your website to learn more or take action.'
        //     };
        // case DESTINATION_TYPES.MESSENGER:
        //     return {
        //         label: 'Messenger',
        //         description: 'Generate leads by starting chats in Messenger.'
        //     };
        // case DESTINATION_TYPES.WHATSAPP:
        //     return {
        //         label: 'WhatsApp',
        //         description: 'Generate leads by starting chats on WhatsApp.'
        //     };
        // case DESTINATION_TYPES.PHONE_CALL:
        //     return {
        //         label: 'Calls',
        //         description: 'Generate leads by asking people to call your business.'
        //     };
        // case DESTINATION_TYPES.APP:
        //     return {
        //         label: 'App',
        //         description: 'Send users to download or open your mobile app.'
        //     };
        // case 'WEBSITE_AND_FORMS':
        //     return {
        //         label: 'Website and instant forms',
        //         description: 'Generate leads through both your website and instant forms.'
        //     };
        // case 'WEBSITE_AND_CALLS':
        //     return {
        //         label: 'Website and calls',
        //         description: 'Generate leads through both your website and calls.'
        //     };
        // case 'INSTAGRAM':
        //     return {
        //         label: 'Instagram',
        //         description: 'Generate leads by starting chats on Instagram.'
        //     };
        // case DESTINATION_TYPES.ON_POST:
        //     return {
        //         label: 'Post engagement',
        //         description: 'Increase engagement with your posts.'
        //     };
        // case DESTINATION_TYPES.ON_PAGE:
        //     return {
        //         label: 'Page likes',
        //         description: 'Get more likes for your Facebook page.'
        //     };
        // case DESTINATION_TYPES.ON_EVENT:
        //     return {
        //         label: 'Event responses',
        //         description: 'Get more people to respond to your events.'
        //     };
        // case DESTINATION_TYPES.ON_VIDEO:
        //     return {
        //         label: 'Video views',
        //         description: 'Get more people to watch your videos.'
        //     };
        // case DESTINATION_TYPES.FACEBOOK:
        //     return {
        //         label: 'Facebook Shop',
        //         description: 'Promote products from your Facebook catalog.'
        //     };
        default:
            return {
                label: destinationType,
                description: 'Choose this destination for your campaign.'
            };
    }
}