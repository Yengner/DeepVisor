'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Avatar,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { IconAlertCircle, IconBrandMeta, IconCheck, IconLock } from '@tabler/icons-react';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { FirstSyncJobStatus, SyncCoverage } from '@/lib/shared/types/integrations';
import type { WhatsAppNumberSource } from '@/lib/shared/types/whatsappSetup';
import BlockingTaskScreen from '@/components/ui/states/BlockingTaskScreen';

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
  status?: string | null;
};

type MetaAccountListResponse = {
  success?: boolean;
  data?: {
    accounts?: Array<{ externalAccountId: string; name: string | null; status?: string | null }>;
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

type MetaPageOption = {
  id: string;
  page_id: string;
  name: string;
  phone: string | null;
  instagram_account_id?: string;
  instagram_account_name?: string | null;
  instagram_account_username?: string | null;
  instagram_account_picture_url?: string | null;
  picture_url?: string;
};

type MetaPageSelectItem = {
  value: string;
  label: string;
  phone: string | null;
  instagramLabel: string | null;
  pictureUrl: string | null;
};

type MetaPagesResponse = {
  success?: boolean;
  data?: {
    pages?: MetaPageOption[];
    selectedPageId?: string | null;
    whatsappSetupCompleted?: boolean;
  };
  error?: {
    userMessage?: string;
  };
};

type MetaPageWhatsAppSetupResponse = {
  success?: boolean;
  error?: {
    userMessage?: string;
  };
};

type MetaPageSetupContext = {
  integrationId: string;
  externalAccountId: string | null;
  pages: MetaPageOption[];
};

type SearchDrivenFlow = {
  integration: string | null;
  status: string | null;
  requiresAccountSelection: boolean;
  integrationId: string | null;
  externalAccountId: string | null;
  autoSync: boolean;
};

function avatarLabel(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : 'P';
}

function formatAccountStatus(status: string | null | undefined): string {
  const trimmed = status?.trim();
  return trimmed ? `Status: ${trimmed}` : 'Meta ad account';
}

function instagramLabelForPage(
  page: Pick<
    MetaPageOption,
    'instagram_account_username' | 'instagram_account_name' | 'instagram_account_id'
  >
): string | null {
  if (!page.instagram_account_id) {
    return null;
  }

  if (page.instagram_account_username?.trim()) {
    return `@${page.instagram_account_username}`;
  }

  return page.instagram_account_name?.trim() || 'Connected Instagram account';
}

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
  const [loadingPageSetup, setLoadingPageSetup] = useState(false);
  const [pageSelectionOpened, setPageSelectionOpened] = useState(false);
  const [pageSetupContext, setPageSetupContext] = useState<MetaPageSetupContext | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [whatsappSetupPage, setWhatsappSetupPage] = useState<MetaPageOption | null>(null);
  const [manualWhatsAppEntry, setManualWhatsAppEntry] = useState(false);
  const [manualWhatsAppNumber, setManualWhatsAppNumber] = useState('');
  const [submittingPageSetup, setSubmittingPageSetup] = useState(false);

  const syncingOpened = submittingAccountSelection || (loadingAccountOptions && autoSyncRequested) || loadingPageSetup;

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

  const resetPageSetup = () => {
    setLoadingPageSetup(false);
    setPageSelectionOpened(false);
    setPageSetupContext(null);
    setSelectedPageId(null);
    setWhatsappSetupPage(null);
    setManualWhatsAppEntry(false);
    setManualWhatsAppNumber('');
    setSubmittingPageSetup(false);
  };

  const finishFlow = async (callback?: () => void) => {
    callback?.();
    router.replace(returnTo);
    if (refreshAfterSuccess) {
      router.refresh();
    }
  };

  const finishFlowWithSuccess = async (message = 'Meta synced successfully.') => {
    toast.success(message);
    await finishFlow(onConnected);
  };

  const completeMetaFlow = async (message?: string) => {
    resetPageSetup();
    await finishFlowWithSuccess(message);
  };

  const loadMetaPageSetup = async (input: {
    integrationId: string;
    externalAccountId?: string | null;
  }): Promise<boolean> => {
    setLoadingPageSetup(true);
    setSyncingTitle('Finding your Facebook Page');
    setSyncingDescription('We are checking Facebook Pages so DeepVisor can prepare WhatsApp lead setup.');

    try {
      const params = new URLSearchParams({
        integrationId: input.integrationId,
      });
      if (input.externalAccountId) {
        params.set('externalAccountId', input.externalAccountId);
      }

      const response = await fetch(`/api/integrations/meta/pages?${params.toString()}`);
      const body = (await response.json().catch(() => ({}))) as MetaPagesResponse;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to load Facebook Pages');
      }

      const pages = Array.isArray(body.data?.pages) ? body.data.pages : [];
      if (body.data?.whatsappSetupCompleted || pages.length === 0) {
        return false;
      }

      const resolvedSelectedPageId =
        body.data?.selectedPageId && pages.some((page) => page.page_id === body.data?.selectedPageId)
          ? body.data.selectedPageId
          : pages[0]?.page_id ?? null;

      setPageSetupContext({
        integrationId: input.integrationId,
        externalAccountId: input.externalAccountId ?? null,
        pages,
      });
      setSelectedPageId(resolvedSelectedPageId);
      setPageSelectionOpened(true);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? `${error.message}. You can set your Facebook Page later.`
          : 'We could not load Facebook Pages. You can set this later.'
      );
      return false;
    } finally {
      setLoadingPageSetup(false);
      setSyncingTitle('Connecting Meta');
      setSyncingDescription('We are preparing your account and starting the first sync.');
    }
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
            status: account.status ?? null,
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
      'DeepVisor is pulling campaigns, ad sets, ads, creatives, recent performance, audience data, summaries, and analysis. Keep this open until it finishes.'
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

      resetFlow();
      const resolvedIntegrationId = body.data?.integrationId ?? integrationId;
      const resolvedExternalAccountId = body.data?.externalAccountId ?? externalAccountId;
      const pageSetupStarted = await loadMetaPageSetup({
        integrationId: resolvedIntegrationId,
        externalAccountId: resolvedExternalAccountId,
      });

      if (!pageSetupStarted) {
        await finishFlowWithSuccess();
      }
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

    void syncMetaAdAccount();
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
      setSyncingDescription('We found your Meta ad account and are syncing it now.');
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

  const handleContinuePageSelection = () => {
    const page = pageSetupContext?.pages.find((item) => item.page_id === selectedPageId) ?? null;
    if (!page) {
      toast.error('Choose a Facebook Page to continue.');
      return;
    }

    setPageSelectionOpened(false);
    setWhatsappSetupPage(page);
    setManualWhatsAppEntry(!page.phone);
    setManualWhatsAppNumber('');
  };

  const savePageWhatsAppSetup = async (
    whatsappNumberSource: WhatsAppNumberSource,
    whatsappNumber?: string | null
  ) => {
    if (!pageSetupContext || !whatsappSetupPage || submittingPageSetup) {
      return;
    }

    setSubmittingPageSetup(true);
    try {
      const response = await fetch('/api/integrations/meta/page-whatsapp-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          integrationId: pageSetupContext.integrationId,
          externalAccountId: pageSetupContext.externalAccountId,
          pageId: whatsappSetupPage.page_id,
          whatsappNumberSource,
          whatsappNumber: whatsappNumber ?? null,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as MetaPageWhatsAppSetupResponse;

      if (!response.ok || !body?.success) {
        throw new Error(body?.error?.userMessage || 'Failed to save WhatsApp setup');
      }

      await completeMetaFlow('Meta synced and WhatsApp setup saved.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to save WhatsApp setup.'
      );
      setSubmittingPageSetup(false);
    }
  };

  const selectedPageForDisplay =
    pageSetupContext?.pages.find((page) => page.page_id === selectedPageId) ?? null;
  const selectedAccountForDisplay =
    accountOptions.find((account) => account.value === selectedAccountExternalId) ?? null;
  const pageSelectOptions: MetaPageSelectItem[] = (pageSetupContext?.pages ?? []).map((page) => ({
    value: page.page_id,
    label: page.name,
    phone: page.phone,
    instagramLabel: instagramLabelForPage(page),
    pictureUrl: page.picture_url ?? null,
  }));
  const skipSource: WhatsAppNumberSource = whatsappSetupPage?.phone ? 'skipped' : 'not_available';

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
            <Group gap="xs">
              <Badge color="blue" variant="light">
                1 primary account
              </Badge>
            </Group>
          </Group>

          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="blue" variant="light" radius="xl" mt={2}>
              <IconLock size={16} />
            </ThemeIcon>
            <Text size="sm">
              Choosing a primary account keeps onboarding, reporting, and AI analysis focused on one clean dataset.
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
              leftSection={
                selectedAccountForDisplay ? (
                  <Avatar color="blue" size={24} radius="xl">
                    <IconBrandMeta size={15} />
                  </Avatar>
                ) : null
              }
              renderOption={({ option }) => {
                const accountOption = option as unknown as MetaAccountOption;
                return (
                  <Group gap="sm" wrap="nowrap">
                    <Avatar color="blue" size={32} radius="xl">
                      <IconBrandMeta size={18} />
                    </Avatar>
                    <Stack gap={0}>
                      <Text size="sm" fw={700}>
                        {accountOption.label}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {formatAccountStatus(accountOption.status)}
                      </Text>
                    </Stack>
                  </Group>
                );
              }}
            />
          )}

          <Group gap="sm" align="flex-start" wrap="nowrap">
            <ThemeIcon color="orange" variant="light" radius="xl" mt={2}>
              <IconAlertCircle size={16} />
            </ThemeIcon>
            <Text size="xs" c="dimmed">
              We only continue once one account is selected. This local sync waits until the
              selected account is populated.
            </Text>
          </Group>

          <Button
            fullWidth
            onClick={() => {
              void syncMetaAdAccount();
            }}
            loading={submittingAccountSelection}
            disabled={!selectedAccountExternalId || loadingAccountOptions}
            leftSection={!submittingAccountSelection ? <IconCheck size={16} /> : undefined}
          >
            Select primary account and start sync
          </Button>
        </Stack>
      </Modal>

      <Modal
        opened={pageSelectionOpened}
        onClose={() => {}}
        title="Choose your Facebook Page"
        centered
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            DeepVisor uses your Facebook Page to prepare message-ready ads and keep the customer
            handoff simple.
          </Text>

          <Select
            label="Facebook Page"
            data={pageSelectOptions}
            value={selectedPageId}
            onChange={setSelectedPageId}
            placeholder="Choose a Page"
            searchable
            nothingFoundMessage="No Pages found"
            leftSection={
              selectedPageForDisplay ? (
                <Avatar
                  src={selectedPageForDisplay.picture_url ?? null}
                  size={24}
                  radius="xl"
                >
                  {avatarLabel(selectedPageForDisplay.name)}
                </Avatar>
              ) : null
            }
            renderOption={({ option }) => {
              const pageOption = option as unknown as MetaPageSelectItem;
              return (
                <Group gap="sm" wrap="nowrap">
                  <Avatar src={pageOption.pictureUrl} size={32} radius="xl">
                    {avatarLabel(pageOption.label)}
                  </Avatar>
                  <Stack gap={0}>
                    <Text size="sm" fw={700}>
                      {pageOption.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {[
                        pageOption.phone ? `Page phone: ${pageOption.phone}` : 'No Page phone found',
                        pageOption.instagramLabel ? `Instagram: ${pageOption.instagramLabel}` : null,
                      ]
                        .filter(Boolean)
                        .join(' - ')}
                    </Text>
                  </Stack>
                </Group>
              );
            }}
          />

          {selectedPageForDisplay ? (
            <Paper withBorder radius="lg" p="sm">
              <Group gap="sm" wrap="nowrap">
                <Avatar src={selectedPageForDisplay.picture_url ?? null} size={38} radius="xl">
                  {avatarLabel(selectedPageForDisplay.name)}
                </Avatar>
                <Stack gap={2}>
                  <Text fw={700} size="sm">
                    {selectedPageForDisplay.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {selectedPageForDisplay.phone
                      ? `Page phone: ${selectedPageForDisplay.phone}`
                      : 'No phone number found on this Page'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {instagramLabelForPage(selectedPageForDisplay)
                      ? `Instagram: ${instagramLabelForPage(selectedPageForDisplay)}`
                      : 'No Instagram account found for this Page'}
                  </Text>
                </Stack>
              </Group>
            </Paper>
          ) : null}

          <Group justify="space-between" gap="sm" wrap="wrap">
            <Button
              variant="default"
              onClick={() => {
                void completeMetaFlow();
              }}
              disabled={submittingPageSetup}
            >
              Skip Page setup
            </Button>
            <Button
              onClick={handleContinuePageSelection}
              disabled={!selectedPageId}
              leftSection={<IconCheck size={16} />}
            >
              Continue
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={Boolean(whatsappSetupPage)}
        onClose={() => {}}
        title="Set up WhatsApp leads"
        centered
        withCloseButton={false}
        closeOnClickOutside={false}
        closeOnEscape={false}
        size="sm"
      >
        {whatsappSetupPage ? (
          <Stack gap="md">
            <Group gap="sm" align="flex-start" wrap="nowrap">
              <ThemeIcon color="green" variant="light" radius="xl" mt={2}>
                <IconCheck size={16} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                WhatsApp helps customers message you directly from ads. This is optional and can be
                updated later.
              </Text>
            </Group>

            {whatsappSetupPage.phone && !manualWhatsAppEntry ? (
              <>
                <Text size="sm">
                  We found this phone number on your Facebook Page:
                </Text>
                <Paper withBorder radius="lg" p="md">
                  <Group gap="sm" wrap="nowrap">
                    <Avatar src={whatsappSetupPage.picture_url ?? null} size={38} radius="xl">
                      {avatarLabel(whatsappSetupPage.name)}
                    </Avatar>
                    <Stack gap={2}>
                      <Text size="sm" fw={700}>
                        {whatsappSetupPage.name}
                      </Text>
                      <Text fw={800}>{whatsappSetupPage.phone}</Text>
                    </Stack>
                  </Group>
                </Paper>
                <Text size="sm">
                  Is this also the WhatsApp number customers should message from your ads?
                </Text>

                <Stack gap="xs">
                  <Button
                    fullWidth
                    onClick={() => {
                      void savePageWhatsAppSetup('page_phone_confirmed', whatsappSetupPage.phone);
                    }}
                    loading={submittingPageSetup}
                  >
                    Yes, use this number
                  </Button>
                  <Button
                    fullWidth
                    variant="default"
                    onClick={() => setManualWhatsAppEntry(true)}
                    disabled={submittingPageSetup}
                  >
                    No, enter a different WhatsApp number
                  </Button>
                  <Button
                    fullWidth
                    variant="subtle"
                    color="gray"
                    onClick={() => {
                      void savePageWhatsAppSetup('skipped');
                    }}
                    disabled={submittingPageSetup}
                  >
                    Skip WhatsApp for now
                  </Button>
                </Stack>
              </>
            ) : (
              <>
                <Text size="sm">
                  {whatsappSetupPage.phone
                    ? 'Enter the WhatsApp number customers should message from your ads.'
                    : 'We could not find a phone number on your Facebook Page. If you want customers to message you on WhatsApp, enter your WhatsApp business number below.'}
                </Text>

                <TextInput
                  label="WhatsApp number"
                  placeholder="+1 813 555 1234"
                  value={manualWhatsAppNumber}
                  onChange={(event) => setManualWhatsAppNumber(event.currentTarget.value)}
                  disabled={submittingPageSetup}
                  inputMode="tel"
                />

                <Stack gap="xs">
                  <Button
                    fullWidth
                    onClick={() => {
                      void savePageWhatsAppSetup('manual', manualWhatsAppNumber);
                    }}
                    loading={submittingPageSetup}
                    disabled={!manualWhatsAppNumber.trim()}
                  >
                    Save WhatsApp number
                  </Button>
                  <Button
                    fullWidth
                    variant="subtle"
                    color="gray"
                    onClick={() => {
                      void savePageWhatsAppSetup(skipSource);
                    }}
                    disabled={submittingPageSetup}
                  >
                    Skip WhatsApp for now
                  </Button>
                </Stack>
              </>
            )}
          </Stack>
        ) : null}
      </Modal>

      <BlockingTaskScreen
        opened={syncingOpened}
        title={syncingTitle}
        description={syncingDescription}
      />
    </>
  );
}
