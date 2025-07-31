export type NotificationType = 'campaign' | 'budget' | 'system' | 'integration';


export interface NotificationCreateProps {
    userId: string;
    title: string;
    message: string;
    type: NotificationType;
    link?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: Record<string, any>;
}
