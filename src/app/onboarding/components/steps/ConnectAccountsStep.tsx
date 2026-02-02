'use client';

import { Button, Text, Title, Stack, Group, Card, Avatar, Badge, Paper, Alert } from '@mantine/core';
import { IconBrandFacebook, IconPlus, IconCheck, IconInfoCircle } from '@tabler/icons-react';
import { useState } from 'react';
import toast from 'react-hot-toast';


type ConnectAccountsStepProps = {
    onNext: () => void;
    onPrev: () => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    userData: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateUserData: (data: any) => void;
};

export default function ConnectAccountsStep({
    onNext,
    onPrev,
    userData
}: ConnectAccountsStepProps) {
    const [connecting, setConnecting] = useState<string | null>(null);

    const handleConnect = async (platform: string) => {
        setConnecting(platform);
        try {
            // Redirect to the OAuth connection URL for Meta
            const returnPath = encodeURIComponent(`/onboarding`)
            window.location.href = `/api/integrations/connect/${platform}?returnPath=${returnPath}`;
        } catch (error) {
            console.error(`Error connecting to ${platform}:`, error);
            toast.error(`Failed to connect to ${platform}. Please try again.`);
            setConnecting(null);
        }
    };

    const isConnected = (platform: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return userData.connectedAccounts.some((acc: any) => acc.platform === platform);
    };

    const getConnectionDetails = (platform: string) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const account = userData.connectedAccounts.find((acc: any) => acc.platform === platform);
        if (!account) return null;

        const connectedDate = new Date(account.connectedAt);
        const formattedDate = connectedDate.toLocaleDateString();

        return {
            id: account.accountId,
            name: account.accountName,
            date: formattedDate
        };
    };

    const metaDetails = getConnectionDetails('meta');

    return (
        <Stack gap="xl" py={16}>
            <div>
                <Title order={2} ta="center">Connect your Meta account</Title>
                <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
                    Link Meta Business Manager to import campaigns, ad sets, and performance data automatically.
                </Text>
            </div>

            <Paper withBorder p="md" radius="md" className="max-w-xl mx-auto w-full">
                <Card withBorder p="lg" radius="md">
                    <Stack>
                        <Group>
                            <Avatar color="blue" radius="xl" size="lg">
                                <IconBrandFacebook size={24} />
                            </Avatar>
                            <div>
                                <Text fw={700} size="lg">Meta Business Manager</Text>
                                <Text size="sm" c="dimmed">Facebook & Instagram Ads</Text>
                            </div>
                        </Group>

                        {isConnected('meta') ? (
                            <div className="mt-4">
                                <Badge color="green" size="lg" fullWidth leftSection={<IconCheck size={14} />}>
                                    Connected
                                </Badge>

                                {metaDetails && (
                                    <Stack gap="xs" mt="md">
                                        <Text fw={500} size="sm">Account: {metaDetails.name}</Text>
                                        <Text size="xs" c="dimmed">ID: {metaDetails.id}</Text>
                                        <Text size="xs" c="dimmed">Connected on {metaDetails.date}</Text>
                                    </Stack>
                                )}
                            </div>
                        ) : (
                            <Button
                                fullWidth
                                size="md"
                                variant="filled"
                                color="blue"
                                leftSection={<IconPlus size={16} />}
                                onClick={() => handleConnect('meta')}
                                loading={connecting === 'meta'}
                                mt="md"
                            >
                                Connect Meta Account
                            </Button>
                        )}
                    </Stack>
                </Card>

                <Alert
                    mt="md"
                    icon={<IconInfoCircle size={16} />}
                    color="blue"
                    variant="light"
                >
                    Additional platforms can be connected later from your settings.
                </Alert>
            </Paper>

            <Text c="dimmed" size="sm" ta="center" mt="md">
                By connecting your Meta account, you allow DeepVisor to access your ad data for analysis and optimization.
                You can revoke access at any time from your Meta Business settings.
            </Text>

            <Group justify="apart" mt="xl">
                <Button variant="light" onClick={onPrev}>
                    Back
                </Button>
                <Group>
                    <Button variant="subtle" onClick={onNext}>
                        Skip for now
                    </Button>
                    <Button onClick={onNext}>
                        Continue
                    </Button>
                </Group>
            </Group>
        </Stack>
    );
}
