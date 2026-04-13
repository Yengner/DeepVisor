'use client';

import { Button, Text, Title, Stack, Group } from '@mantine/core';
import MetaIntegrationPrompt from '@/components/integrations/MetaIntegrationPrompt';
import MetaIntegrationFlow from '@/components/integrations/MetaIntegrationFlow';

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
  userData,
  updateUserData,
}: ConnectAccountsStepProps) {
  const isConnected = (platform: string) => {
    const connectedPlatforms = Array.isArray(userData?.connectedPlatforms) ? userData.connectedPlatforms : [];
    return connectedPlatforms.includes(platform);
  };

  return (
    <MetaIntegrationFlow
      returnTo="/onboarding"
      refreshAfterSuccess={false}
      onConnected={() => {
        updateUserData({
          connectedPlatforms: isConnected('meta')
            ? userData.connectedPlatforms
            : [...(Array.isArray(userData?.connectedPlatforms) ? userData.connectedPlatforms : []), 'meta'],
        });
        onNext();
      }}
    >
      {({ connectMeta, connecting }) => (
        <Stack gap="xl" py={16}>
          <div>
            <Title order={2} ta="center">Connect Meta now, or do it later</Title>
            <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
              DeepVisor can start with the business context you already provided. Connect Meta when you want live campaigns, ad sets, ads, and performance history to power the dashboard.
            </Text>
          </div>

          <div className="max-w-xl mx-auto w-full">
            <MetaIntegrationPrompt
              connected={isConnected('meta')}
              connecting={connecting}
              onConnect={connectMeta}
            />
          </div>

          <Text c="dimmed" size="sm" ta="center" mt="md">
            Connecting is recommended, but not required to finish setup. You can connect or change the selected ad account later from Integrations.
          </Text>

          <Group justify="apart" mt="xl">
            <Button variant="light" onClick={onPrev}>
              Back
            </Button>
            <Group>
              <Button variant="default" onClick={onNext}>
                Skip integration for now
              </Button>
              <Button onClick={connectMeta} loading={connecting}>
                Connect Meta
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </MetaIntegrationFlow>
  );
}
