'use client';

import { Container, Card, Title, Text, Stack, Button, Group, Divider } from '@mantine/core';
import { IconRobot, IconSettings, IconMessage, IconBolt, IconBulb } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';

export default function CompanionClient() {
    const router = useRouter();

    return (
        <Container size="md" py="xl">
            <Stack gap="xl">
                <Card withBorder p="xl" radius="md">
                    <Group align="center" mb="md">
                        <IconRobot size={32} color="#228be6" />
                        <Title order={2}>Agency Companion</Title>
                    </Group>
                    <Text c="dimmed" mb="md">
                        Your AI-powered agency assistant. Ask questions, automate tasks, and control your agency operations from one place.
                    </Text>
                    <Divider my="md" />
                    <Stack gap="md">
                        <Button
                            leftSection={<IconBulb size={18} />}
                            variant="gradient"
                            gradient={{ from: 'yellow', to: 'teal', deg: 60 }}
                            size="md"
                            radius="md"
                            onClick={() => router.push('campaigns/agency/create')}
                        >
                            Create Smart Campaign
                        </Button>
                        <Button
                            leftSection={<IconMessage size={18} />}
                            variant="light"
                            color="blue"
                            size="md"
                            radius="md"
                            disabled
                        >
                            Chat with Companion (Coming Soon)
                        </Button>
                        <Button
                            leftSection={<IconBolt size={18} />}
                            variant="light"
                            color="teal"
                            size="md"
                            radius="md"
                            disabled
                        >
                            Run Automation (Coming Soon)
                        </Button>
                        <Button
                            leftSection={<IconSettings size={18} />}
                            variant="light"
                            color="gray"
                            size="md"
                            radius="md"
                            disabled
                        >
                            Settings (Coming Soon)
                        </Button>
                    </Stack>
                </Card>
                <Card withBorder p="lg" radius="md">
                    <Title order={4} mb="xs">Recent Activity</Title>
                    <Text c="dimmed" size="sm">
                        No recent activity yet. Your actions and automations will appear here.
                    </Text>
                </Card>
            </Stack>
        </Container>
    );
}