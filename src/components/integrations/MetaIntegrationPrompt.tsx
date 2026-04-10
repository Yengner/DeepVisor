'use client';

import { Alert, Avatar, Badge, Button, Card, Group, Paper, Stack, Text } from '@mantine/core';
import { IconBrandFacebook, IconCheck, IconInfoCircle, IconPlus } from '@tabler/icons-react';

type MetaIntegrationPromptProps = {
  connected: boolean;
  connecting: boolean;
  onConnect: () => void;
  lastError?: string | null;
  note?: string;
};

export default function MetaIntegrationPrompt({
  connected,
  connecting,
  onConnect,
  lastError,
  note = 'Additional platforms can be connected later from your integration settings.',
}: MetaIntegrationPromptProps) {
  return (
    <Paper withBorder p="md" radius="md">
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

          {connected ? (
            <div>
              <Badge color="green" size="lg" fullWidth leftSection={<IconCheck size={14} />}>
                Connected
              </Badge>
              <Text size="sm" c="dimmed" mt="sm">
                Your Meta integration is active and ready for sync.
              </Text>
            </div>
          ) : (
            <>
              {lastError ? (
                <Text size="xs" c="red">
                  {lastError}
                </Text>
              ) : null}
              <Button
                fullWidth
                size="md"
                variant="filled"
                color="blue"
                leftSection={<IconPlus size={16} />}
                onClick={onConnect}
                loading={connecting}
                mt="md"
              >
                Connect Meta Account
              </Button>
            </>
          )}
        </Stack>
      </Card>

      <Alert mt="md" icon={<IconInfoCircle size={16} />} color="blue" variant="light">
        {note}
      </Alert>
    </Paper>
  );
}
