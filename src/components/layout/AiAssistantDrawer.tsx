'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  Group,
  Paper,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconArrowUpRight,
  IconCheck,
  IconRefresh,
  IconRobot,
  IconSend,
  IconSparkles,
} from '@tabler/icons-react';
import type { GlobalAiAssistantPayload } from '@/lib/server/intelligence';

type AiAssistantDrawerProps = {
  payload: GlobalAiAssistantPayload;
};

type ThreadMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

const quickPrompts = [
  'What matters right now?',
  'What should I fix first?',
  'What was my best ad creative?',
  'What were my best months?',
];

function createMessage(role: ThreadMessage['role'], text: string): ThreadMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
  };
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatStateLabel(value: string): string {
  return value.replace(/_/g, ' ');
}

function initialAssistantMessage(payload: GlobalAiAssistantPayload): ThreadMessage {
  if (payload.state === 'no_platform_connected') {
    return createMessage(
      'assistant',
      'Connect a platform first. Once a Meta account is connected, this side panel can stay with you across the app.'
    );
  }

  if (payload.state === 'no_ad_account_selected') {
    return createMessage(
      'assistant',
      'Choose a primary ad account first. This assistant stays scoped to the selected account so the advice stays simple.'
    );
  }

  if (payload.state === 'needs_assessment') {
    return createMessage(
      'assistant',
      `I can see ${payload.selectedAdAccountName ?? 'your selected ad account'}, but it has not been assessed yet. Run a fresh AI review here and I will summarize it for you.`
    );
  }

  return createMessage(
    'assistant',
    payload.activeFindings[0]?.summary ??
      payload.latestSelectedAssessment?.assessment.summary ??
      'Your selected ad account is ready. Ask about best ad creative, best months, top risks, or what matters right now.'
  );
}

export default function AiAssistantDrawer({ payload }: AiAssistantDrawerProps) {
  const router = useRouter();
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ThreadMessage[]>(() => [initialAssistantMessage(payload)]);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [isRefreshing, startRefreshTransition] = useTransition();

  useEffect(() => {
    setMessages([initialAssistantMessage(payload)]);
    setFeedback(null);
    setDraft('');
  }, [payload.selectedAdAccountId, payload.latestSelectedAssessment?.id, payload.state]);

  async function submitQuestion(question: string) {
    const trimmed = question.trim();

    if (!trimmed) {
      return;
    }

    setMessages((current) => [...current, createMessage('user', trimmed)]);
    setDraft('');

    if (!payload.selectedAdAccountId) {
      setMessages((current) => [
        ...current,
        createMessage('assistant', 'Pick a primary ad account first so I can answer from the right account history.'),
      ]);
      return;
    }

    setIsAsking(true);

    try {
      const response = await fetch('/api/intelligence/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: trimmed,
          platformIntegrationId: payload.selectedPlatformIntegrationId,
          adAccountId: payload.selectedAdAccountId,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body?.success) {
        throw new Error(body?.error || 'Failed to answer this question.');
      }

      setMessages((current) => [
        ...current,
        createMessage('assistant', String(body.answer ?? 'No answer available right now.')),
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          error instanceof Error
            ? error.message
            : 'DeepVisor could not answer that question right now.'
        ),
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  async function refreshAssessment() {
    if (!payload.selectedPlatformIntegrationId) {
      return;
    }

    setFeedback(null);

    try {
      const response = await fetch('/api/intelligence/assess', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'integration',
          platformIntegrationId: payload.selectedPlatformIntegrationId,
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to refresh AI review');
      }

      setFeedback({
        type: 'success',
        message: 'AI review refreshed for the selected ad account.',
      });
      startRefreshTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error instanceof Error ? error.message : 'Failed to refresh the selected account review.',
      });
    }
  }

  const selectedAssessment = payload.latestSelectedAssessment;
  const currentStateLabel = selectedAssessment
    ? formatStateLabel(selectedAssessment.state)
    : payload.state === 'needs_assessment'
      ? 'needs assessment'
      : payload.state === 'no_platform_connected'
        ? 'not connected'
        : 'no account selected';

  return (
    <>
      <Button
        radius="xl"
        size="md"
        leftSection={<IconSparkles size={18} />}
        onClick={() => setOpened(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          zIndex: 80,
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
        }}
      >
        Ask DeepVisor
      </Button>

      <Drawer
        opened={opened}
        onClose={() => setOpened(false)}
        position="right"
        size={440}
        padding="lg"
        withOverlay={false}
        lockScroll={false}
        trapFocus={false}
        returnFocus={false}
        closeOnClickOutside={false}
        styles={{
          content: {
            height: '100dvh',
            maxHeight: '100dvh',
          },
          body: {
            height: 'calc(100dvh - 76px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
        title={
          <Group gap="sm">
            <ThemeIcon radius="xl" variant="light" color="blue">
              <IconRobot size={18} />
            </ThemeIcon>
            <div>
              <Text fw={700}>DeepVisor AI</Text>
              <Text size="xs" c="dimmed">
                Selected ad account side panel
              </Text>
            </div>
          </Group>
        }
      >
        <Stack gap="lg" h="100%" style={{ minHeight: 0 }}>
          <Paper withBorder radius="xl" p="lg" bg="var(--mantine-color-blue-0)">
            <Group justify="space-between" align="flex-start" mb="sm">
              <div>
                <Text size="xs" fw={700} tt="uppercase" c="dimmed">
                  Current context
                </Text>
                <Title order={4} mt={4}>
                  {payload.selectedAdAccountName ?? 'No ad account selected'}
                </Title>
                <Text size="sm" c="dimmed" mt={4}>
                  {payload.selectedPlatformLabel ?? 'No platform connected'} · {payload.businessName}
                </Text>
              </div>
              <Badge variant="light" color={selectedAssessment ? 'blue' : 'gray'}>
                {currentStateLabel}
              </Badge>
            </Group>

            <Text size="sm">
              {selectedAssessment?.assessment.summary ??
                'Open this side panel from anywhere in the app to keep the selected account context close by.'}
            </Text>
          </Paper>

          <SimpleGrid cols={2} spacing="sm">
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={() => void refreshAssessment()}
              loading={isRefreshing}
              disabled={!payload.selectedPlatformIntegrationId}
            >
              Refresh AI review
            </Button>
            <Button
              component={Link}
              href="/calendar"
              variant="default"
              leftSection={<IconArrowUpRight size={16} />}
            >
              Open calendar
            </Button>
          </SimpleGrid>

          {feedback ? (
            <Paper
              withBorder
              radius="lg"
              p="sm"
              bg={feedback.type === 'success' ? 'var(--mantine-color-green-0)' : 'var(--mantine-color-red-0)'}
            >
              <Group gap="xs" wrap="nowrap">
                <ThemeIcon
                  color={feedback.type === 'success' ? 'green' : 'red'}
                  variant="light"
                  radius="xl"
                >
                  <IconCheck size={14} />
                </ThemeIcon>
                <Text size="sm">{feedback.message}</Text>
              </Group>
            </Paper>
          ) : null}

          <Stack gap="sm">
            <Text size="sm" fw={700}>
              Quick prompts
            </Text>
            <SimpleGrid cols={2} spacing="sm">
              {quickPrompts.map((prompt) => (
                <Button
                  key={prompt}
                  variant="light"
                  color="gray"
                  justify="flex-start"
                  styles={{
                    inner: { justifyContent: 'flex-start' },
                    label: { whiteSpace: 'normal', textAlign: 'left' },
                  }}
                  onClick={() => void submitQuestion(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </SimpleGrid>
          </Stack>

          <Divider />

          <Box style={{ flex: 1, minHeight: 0 }}>
            <Stack gap="sm" h="100%">
              <Text size="sm" fw={700}>
                Chat
              </Text>
              <ScrollArea h="100%" offsetScrollbars>
                <Stack gap="sm" pr="xs">
                  {messages.map((message) => (
                    <Paper
                      key={message.id}
                      withBorder
                      radius="lg"
                      p="sm"
                      bg={
                        message.role === 'assistant'
                          ? 'var(--mantine-color-gray-0)'
                          : 'var(--mantine-color-blue-0)'
                      }
                      ml={message.role === 'assistant' ? 0 : 36}
                      mr={message.role === 'assistant' ? 36 : 0}
                    >
                      <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
                        {message.role === 'assistant' ? 'DeepVisor' : 'You'}
                      </Text>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {message.text}
                      </Text>
                    </Paper>
                  ))}
                </Stack>
              </ScrollArea>
            </Stack>
          </Box>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitQuestion(draft);
            }}
          >
            <Stack gap="sm">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
                minRows={2}
                maxRows={4}
                autosize
                placeholder="Ask for a summary, top risk, strongest campaign, or next step."
              />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  Stays limited to the selected ad account.
                </Text>
                <Button type="submit" leftSection={<IconSend size={16} />}>
                  {isAsking ? 'Thinking...' : 'Send'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Stack>
      </Drawer>
    </>
  );
}
