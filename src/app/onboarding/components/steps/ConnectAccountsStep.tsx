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
            <Title order={2} ta="center">Connect your Meta account</Title>
            <Text size="lg" c="dimmed" ta="center" className="max-w-xl mx-auto">
              Link Meta Business Manager to import campaigns, ad sets, and performance data automatically.
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
      )}
    </MetaIntegrationFlow>
  );
}
