'use client';

import { initiateOAuthConnection } from '@/lib/actions/integration.actions';
import { Button, Text, Title, Stack, Group, Card, Avatar, Badge } from '@mantine/core';
import { IconBrandFacebook, IconBrandGoogle, IconBrandTiktok, IconPlus, IconCheck } from '@tabler/icons-react';
import { useState } from 'react';

type ConnectAccountsStepProps = {
    onNext: () => void;
    onPrev: () => void;
    userData: any;
    updateUserData: (data: any) => void;
};

export default function ConnectAccountsStep({
    onNext,
    onPrev,
    userData
}: ConnectAccountsStepProps) {
    const [connecting, setConnecting] = useState<string | null>(null);
    const { connectedAccounts = [] } = userData;

    const handleConnect = async (platform: string) => {
        setConnecting(platform);
        try {
            // This would be your OAuth flow initiation
            const url = await initiateOAuthConnection(platform);
            window.location.href = url;
        } catch (error) {
            console.error(`Error connecting to ${platform}:`, error);
        } finally {
            setConnecting(null);
        }
    };

    const isConnected = (platform: string) => {
        return connectedAccounts.some((acc: any) => acc.platform === platform);
    };

    return (
        <Stack gap="xl" py={20}>
            <Title order={2} ta="center">Connect Your Ad Accounts</Title>

            <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto mb-6">
                Link your advertising accounts to import your campaigns, ad sets, and ads automatically.
            </Text>

            <div className="grid gap-4 md:grid-cols-2 my-4">
                <Card withBorder p="md">
                    <Group justify="apart">
                        <Group>
                            <Avatar color="blue" radius="xl">
                                <IconBrandFacebook />
                            </Avatar>
                            <div>
                                <Text fw={600}>Meta Business Manager</Text>
                                <Text size="xs" color="dimmed">Facebook & Instagram Ads</Text>
                            </div>
                        </Group>

                        {isConnected('meta') ? (
                            <Badge color="green" leftSection={<IconCheck size={14} />}>
                                Connected
                            </Badge>
                        ) : (
                            <Button
                                variant="light"
                                color="blue"
                                leftSection={<IconPlus size={16} />}
                                onClick={() => handleConnect('meta')}
                                loading={connecting === 'meta'}
                            >
                                Connect
                            </Button>
                        )}
                    </Group>
                </Card>

                <Card withBorder p="md">
                    <Group justify="apart">
                        <Group>
                            <Avatar color="red" radius="xl">
                                <IconBrandGoogle />
                            </Avatar>
                            <div>
                                <Text fw={600}>Google Ads</Text>
                                <Text size="xs" color="dimmed">Search & Display Campaigns</Text>
                            </div>
                        </Group>

                        {isConnected('google') ? (
                            <Badge color="green" leftSection={<IconCheck size={14} />}>
                                Connected
                            </Badge>
                        ) : (
                            <Button
                                variant="light"
                                color="red"
                                leftSection={<IconPlus size={16} />}
                                onClick={() => handleConnect('google')}
                                loading={connecting === 'google'}
                            >
                                Connect
                            </Button>
                        )}
                    </Group>
                </Card>

                <Card withBorder p="md">
                    <Group justify="apart">
                        <Group>
                            <Avatar color="dark" radius="xl">
                                <IconBrandTiktok />
                            </Avatar>
                            <div>
                                <Text fw={600}>TikTok Ads</Text>
                                <Text size="xs" color="dimmed">Video Campaigns</Text>
                            </div>
                        </Group>

                        {isConnected('tiktok') ? (
                            <Badge color="green" leftSection={<IconCheck size={14} />}>
                                Connected
                            </Badge>
                        ) : (
                            <Button
                                variant="light"
                                color="dark"
                                leftSection={<IconPlus size={16} />}
                                onClick={() => handleConnect('tiktok')}
                                loading={connecting === 'tiktok'}
                            >
                                Connect
                            </Button>
                        )}
                    </Group>
                </Card>
            </div>

            <Text c="dimmed" size="sm" ta="center" className="mt-4">
                You can connect additional accounts later in your account settings.
            </Text>

            <Group justify="apart" mt="xl">
                <Button variant="light" onClick={onPrev}>
                    Back
                </Button>
                <Button onClick={onNext}>
                    Continue
                </Button>
            </Group>
        </Stack>
    );
}