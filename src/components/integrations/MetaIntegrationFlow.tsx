'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Select,
  Stack,
  Text,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconCheck, IconLock } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { FirstSyncJobStatus, SyncCoverage } from '@/lib/shared/types/integrations';
import BlockingTaskScreen from '@/components/ui/states/BlockingTaskScreen';
import { trackFirstSyncJob } from './firstSyncTracking';

type MetaIntegrationFlowProps = {
  returnTo: '/onboarding' | '/integration';
  refreshAfterSuccess?: boolean;
  onConnected?: () => void;
  children: (controls: {
    connectMeta: () => void;
    connecting: boolean;
  }) => React.ReactNode;
};

type MetaAccountOption = {
  value: string;
  label: string;
};

type MetaAccountListResponse = {
  success?: boolean;
  data?: {
    accounts?: Array<{ externalAccountId: string; name: string | null }>;
    primaryAdAccountExternalId?: string | null;
  };
  error?: {
    userMessage?: string;
  };
};

type MetaSelectResponse = {
  success?: boolean;
  data?: {
    integrationId?: string;
    adAccountId?: string | null;
    externalAccountId?: string;
    syncCoverage?: SyncCoverage | null;
    firstSyncJob?: FirstSyncJobStatus | null;
  };
  error?: {
    userMessage?: string;
  };
};

type SearchDrivenFlow = {
  integration: string | null;
  status: string | null;
  requiresAccountSelection: boolean;
  integrationId: string | null;
  externalAccountId: string | null;
  autoSync: boolean;
};

function readFlowState(searchParams: { get: (key: string) => string | null }): SearchDrivenFlow {
  return {
    integration: searchParams.get('integration'),
    status: searchParams.get('status'),
    requiresAccountSelection: searchParams.get('requires_account_selection') === '1',
    integrationId: searchParams.get('integrationId'),
    externalAccountId: searchParams.get('externalAccountId'),
    autoSync: searchParams.get('auto_sync') === '1',
  };
}

export default function MetaIntegrationFlow({
  returnTo,
  refreshAfterSuccess = true,
  onConnected,
  children,
}: MetaIntegrationFlowProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const handledSearchKey = useRef<string | null>(null);
  const selectionRequestInFlight = useRef(false);
  const [connecting, setConnecting] = useState(false);
  const [accountSelectionOpened, setAccountSelectionOpened] = useState(false);
  const [accountSelectionRequired, setAccountSelectionRequired] = useState(false);
  const [accountSelectionIntegrationId, setAccountSelectionIntegrationId] = useState<string | null>(null);
  const [accountOptions, setAccountOptions] = useState<MetaAccountOption[]>([]);
  const [selectedAccountExternalId, setSelectedAccountExternalId] = useState<string | null>(null);
  const [loadingAccountOptions, setLoadingAccountOptions] = useState(false);
  const [submittingAccountSelection, setSubmittingAccountSelection] = useState(false);
  const [autoSyncRequested, setAutoSyncRequested] = useState(false);
  const [syncingTitle, setSyncingTitle] = useState('Connecting Meta');
  const [syncingDescription, setSyncingDescription] = useState(
    'We are preparing your account and starting the first sync.'
  );

  const syncingOpened = submittingAccountSelection || (loadingAccountOptions && autoSyncRequested);

  const resetFlow = () => {
    selectionRequestInFlight.current = false;
    setAccountSelectionOpened(false);
    setAccountSelectionRequired(false);
    setAccountSelectionIntegrationId(null);
    setAccountOptions([]);
    setSelectedAccountExternalId(null);
    setLoadingAccountOptions(false);
    setSubmittingAccountSelection(false);
    setAutoSyncRequested(false);
    setSyncingTitle('Connecting Meta');
    setSyncingDescription('We are preparing your account and starting the first sync.');
  };

  const finishFlow = async (callback?: () => void) => {
    callback?.();
    router.replace(returnTo);
    if (refreshAfterSuccess) {
      router.refresh();
    }
  };

  const finishFlowWithSuccess = async () => {
    toast.success('Meta connected successfully.');
    await finishFlow(onConnected);
  };

  const loadMetaAccountOptions = async (input: {
    integrationId: string;
    preferredExternalAccountId?: string | null;
    autoSync?: boolean;
  }) => {
    setAccountSelectionIntegrationId(input.integrationId);
    setAccountSelectionRequired(true);
    setAutoSyncRequested(Boolean(input.autoSync));
    setLoadingAccountOptions(true);
    setAccountSelectionOpened(true);

    if (input.autoSync) {
      setSyncingTitle('Checking your Meta ad account');
      setSyncingDescription('We are confirming the account and getting ready to sync its data.');
    }

    try {
      const response = await fetch(
        `/api/integrations/meta/ad-accounts?integrationId=${input.integrationId}`
      );
      const body = (await response.json().catch(() => ({}))) as MetaAccountListResponse;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to load Meta ad accounts');
      }

      const options = Array.isArray(body.data?.accounts)
        ? body.data.accounts.map((account) => ({
            value: account.externalAccountId,
            label: account.name || account.externalAccountId,
          }))
        : [];

      const serverSelectedExternalId =
        typeof body.data?.primaryAdAccountExternalId === 'string'
          ? body.data.primaryAdAccountExternalId
          : null;
      const resolvedExternalAccountId =
        input.preferredExternalAccountId ??
        serverSelectedExternalId ??
        options[0]?.value ??
        null;

      setAccountOptions(options);
      setSelectedAccountExternalId(resolvedExternalAccountId);
    } catch (error) {
      resetFlow();
      toast.error(error instanceof Error ? error.message : 'Failed to load Meta ad accounts');
      await finishFlow();
    } finally {
      setLoadingAccountOptions(false);
    }
  };

  const syncMetaAdAccount = async (input?: {
    integrationId?: string | null;
    externalAccountId?: string | null;
  }) => {
    const integrationId = input?.integrationId ?? accountSelectionIntegrationId;
    const externalAccountId = input?.externalAccountId ?? selectedAccountExternalId;

    if (
      !integrationId ||
      !externalAccountId ||
      submittingAccountSelection ||
      selectionRequestInFlight.current
    ) {
      return;
    }

    selectionRequestInFlight.current = true;
    setSubmittingAccountSelection(true);
    setSyncingTitle('Syncing your primary ad account');
    setSyncingDescription(
      'DeepVisor is pulling your campaigns, ad sets, ads, creatives, and recent performance. This can take a minute.'
    );

    try {
      const response = await fetch('/api/integrations/meta/select-ad-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId,
          externalAccountId,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as MetaSelectResponse;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to select Meta ad account');
      }

      const firstSyncJob = body.data?.firstSyncJob ?? null;
      resetFlow();

      if (firstSyncJob && body.data?.integrationId && body.data?.adAccountId && body.data.externalAccountId) {
        trackFirstSyncJob({
          jobId: firstSyncJob.jobId,
          integrationId: body.data.integrationId,
          adAccountId: body.data.adAccountId,
          externalAccountId: body.data.externalAccountId,
          adAccountName: accountOptions.find(
            (option) => option.value === body.data?.externalAccountId
          )?.label ?? null,
          platformKey: 'meta',
          platformName: 'Meta',
          job: firstSyncJob,
        });
        toast.success('Meta connected. Full history sync started in the background.');
        await finishFlow(onConnected);
        return;
      }

      if (
        body.data?.syncCoverage?.activeJobStatus === 'queued' ||
        body.data?.syncCoverage?.activeJobStatus === 'running'
      ) {
        toast.success('Recent data is ready while a larger historical sync continues.');
      }

      await finishFlowWithSuccess();
    } catch (error) {
      setSubmittingAccountSelection(false);
      setAutoSyncRequested(false);
      toast.error(
        error instanceof Error ? error.message : 'Failed to select Meta ad account'
      );
    } finally {
      selectionRequestInFlight.current = false;
    }
  };

  const submitSelectedAdAccount = async () => {
    await syncMetaAdAccount();
  };

  useEffect(() => {
    if (
      !autoSyncRequested ||
      loadingAccountOptions ||
      !accountSelectionIntegrationId ||
      !selectedAccountExternalId ||
      submittingAccountSelection
    ) {
      return;
    }

    void submitSelectedAdAccount();
  }, [
    autoSyncRequested,
    loadingAccountOptions,
    accountSelectionIntegrationId,
    selectedAccountExternalId,
    submittingAccountSelection,
  ]);

  useEffect(() => {
    const flow = readFlowState(searchParams);
    const searchKey = searchParams.toString();

    if (handledSearchKey.current === searchKey) {
      return;
    }

    if (flow.integration !== 'meta' || !flow.status) {
      return;
    }

    handledSearchKey.current = searchKey;
    setConnecting(false);

    if (flow.status === 'error') {
      toast.error('Failed to connect Meta. Please try again.');
      void finishFlow();
      return;
    }

    if (flow.autoSync && flow.integrationId && flow.externalAccountId) {
      setAccountSelectionIntegrationId(flow.integrationId);
      setSelectedAccountExternalId(flow.externalAccountId);
      setAutoSyncRequested(true);
      setSyncingTitle('Checking your Meta ad account');
      setSyncingDescription('We found your Meta ad account and are starting the first sync now.');
      void syncMetaAdAccount({
        integrationId: flow.integrationId,
        externalAccountId: flow.externalAccountId,
      });
      return;
    }

    if (flow.requiresAccountSelection && flow.integrationId) {
      void loadMetaAccountOptions({
        integrationId: flow.integrationId,
        preferredExternalAccountId: flow.externalAccountId,
        autoSync: flow.autoSync,
      });
      return;
    }

    if (flow.status === 'connected') {
      toast.success('Meta connected successfully.');
      void finishFlow(onConnected);
    }
  }, [searchParams]);

  const connectMeta = () => {
    setConnecting(true);
    const encodedReturnTo = encodeURIComponent(returnTo);
    window.location.href = `/api/integrations/connect/meta?returnTo=${encodedReturnTo}`;
  };

  return (
    <>
      {children({
        connectMeta,
        connecting,
      })}

      <Modal
        opened={accountSelectionOpened}
        onClose={() => {}}
        title="Choose one Meta ad account"
        centered
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
      >
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <Stack gap={4}>
              <Text size="sm" c="dimmed">
                DeepVisor syncs one primary Meta ad account per connection. If your Meta login can
                access multiple accounts, choose the one you want to populate first.
              </Text>
              <Text size="xs" c="dimmed">
                You can keep more accounts connected in Meta, but this integration will sync only
                the selected primary account.
              </Text>
            </Stack>
            <Badge color="blue" variant="light">
              1 primary account
            </Badge>
          </Group>

          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="blue" variant="light" radius="xl" mt={2}>
              <IconLock size={16} />
            </ThemeIcon>
            <Text size="sm">
              Choosing a primary account keeps onboarding, reporting, and AI analysis focused on
              one clean dataset.
            </Text>
          </Group>

          {loadingAccountOptions ? (
            <Group justify="center" py="lg">
              <Loader size="sm" />
            </Group>
          ) : (
            <Select
              label="Primary Meta ad account"
              data={accountOptions}
              value={selectedAccountExternalId}
              onChange={setSelectedAccountExternalId}
              placeholder="Choose an ad account"
              searchable
              nothingFoundMessage="No ad accounts found"
            />
          )}

          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="orange" variant="light" radius="xl" mt={2}>
              <IconAlertCircle size={16} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              We only continue once one account is selected. Full history sync can keep running in
              the background after that.
            </Text>
          </Group>

          <Button
            fullWidth
            onClick={() => {
              void submitSelectedAdAccount();
            }}
            loading={submittingAccountSelection}
            disabled={!selectedAccountExternalId || loadingAccountOptions}
            leftSection={!submittingAccountSelection ? <IconCheck size={16} /> : undefined}
          >
            Select primary account and start sync
          </Button>
        </Stack>
      </Modal>

      <BlockingTaskScreen
        opened={syncingOpened}
        title={syncingTitle}
        description={syncingDescription}
      />
    </>
  );
}
