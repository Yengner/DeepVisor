import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconCalendarTime,
  IconChartBar,
  IconDownload,
  IconFileAnalytics,
  IconReportAnalytics,
} from '@tabler/icons-react';
import { notFound } from 'next/navigation';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import {
  getArchivedReport,
  type ArchivedReport,
} from '@/lib/server/intelligence/repositories/reportArchive';
import { createAdminClient } from '@/lib/server/supabase/admin';

function formatDateOnly(value: string | null): string {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'Pending';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatReportWindow(report: ArchivedReport): string {
  if (!report.dateFrom && !report.dateTo) {
    return 'Window unavailable';
  }

  const start = formatDateOnly(report.dateFrom ?? report.dateTo);
  const end = formatDateOnly(report.dateTo ?? report.dateFrom);

  return start === end ? start : `${start} - ${end}`;
}

function formatCurrency(value: number | null): string {
  if (typeof value !== 'number') {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number | null): string {
  return typeof value === 'number' ? value.toLocaleString() : 'n/a';
}

function formatPercent(value: number | null): string {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : 'n/a';
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <Card withBorder radius="lg" p="lg">
      <Group justify="space-between" align="flex-start" gap="md" wrap="nowrap">
        <div style={{ minWidth: 0 }}>
          <Text size="xs" tt="uppercase" fw={800} c="dimmed">
            {label}
          </Text>
          <Title order={3} mt={6}>
            {value}
          </Title>
          <Text size="sm" c="dimmed" mt={4}>
            {detail}
          </Text>
        </div>
        <ThemeIcon color="blue" variant="light" radius="md" size="lg">
          {icon}
        </ThemeIcon>
      </Group>
    </Card>
  );
}

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ queueItemId: string }>;
}) {
  const { queueItemId } = await params;
  const { businessId } = await getRequiredAppContext();
  const report = await getArchivedReport(createAdminClient() as any, {
    businessId,
    queueItemId,
  });

  if (!report) {
    notFound();
  }

  const reportWindow = formatReportWindow(report);

  return (
    <Container size="xl" py="xl">
      <Stack gap="lg">
        <Card withBorder radius="lg" p="xl" className="app-platform-page-hero">
          <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
            <Stack gap="sm" maw={780}>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" className="app-platform-page-badge">
                  Campaign report
                </Badge>
                <Badge color="blue" variant="light">
                  {report.levelLabel}
                </Badge>
                {report.storagePath ? (
                  <Badge color="green" variant="light">
                    Generated
                  </Badge>
                ) : null}
              </Group>

              <div>
                <Text size="sm" fw={700} className="app-platform-page-kicker">
                  {reportWindow}
                </Text>
                <Title order={1} mt={4} className="app-platform-page-title">
                  {report.title}
                </Title>
                <Text size="md" maw={720} mt="xs" className="app-platform-page-copy">
                  This is the dedicated result page for the queued campaign report. Review the
                  generated performance snapshot here, then download the stored copy if you need
                  to share it.
                </Text>
              </div>

              <Group gap="xs" wrap="wrap">
                {report.adAccountName ? (
                  <Badge color="gray" variant="outline">
                    {report.adAccountName}
                  </Badge>
                ) : null}
                <Badge color="gray" variant="outline">
                  Generated {formatDateTime(report.generatedAt)}
                </Badge>
              </Group>
            </Stack>

            <Group gap="xs">
              <Button
                component="a"
                href="/reports"
                radius="xl"
                variant="default"
                leftSection={<IconArrowLeft size={16} />}
              >
                Reports
              </Button>
              {report.downloadHref ? (
                <Button
                  component="a"
                  href={report.downloadHref}
                  radius="xl"
                  leftSection={<IconDownload size={16} />}
                >
                  Download
                </Button>
              ) : null}
            </Group>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md">
          <SummaryCard
            label="Spend"
            value={formatCurrency(report.summary.spend)}
            detail="Spend in the generated report window."
            icon={<IconChartBar size={18} />}
          />
          <SummaryCard
            label="Results"
            value={formatNumber(report.summary.results)}
            detail="Primary results for the report scope."
            icon={<IconReportAnalytics size={18} />}
          />
          <SummaryCard
            label="Cost/result"
            value={formatCurrency(report.summary.costPerResult)}
            detail="Average cost per result in this report."
            icon={<IconFileAnalytics size={18} />}
          />
          <SummaryCard
            label="CTR"
            value={formatPercent(report.summary.ctr)}
            detail={`Clicks ${formatNumber(report.summary.clicks)} · CPC ${formatCurrency(report.summary.cpc)}`}
            icon={<IconCalendarTime size={18} />}
          />
        </SimpleGrid>

        {report.pdfHref ? (
          <Card withBorder radius="lg" p={{ base: 'xs', sm: 'md' }}>
            <iframe
              title={report.title}
              src={report.pdfHref}
              style={{
                width: '100%',
                height: '78vh',
                minHeight: 640,
                border: 0,
                borderRadius: 12,
                background: '#f8fafc',
              }}
            />
          </Card>
        ) : (
          <Alert
            color="yellow"
            radius="lg"
            icon={<IconAlertCircle size={18} />}
            title="Stored report unavailable"
          >
            <Text size="sm">
              The queue item completed, but no report file is attached yet. Run the report queue
              again to generate a stored campaign report.
            </Text>
          </Alert>
        )}
      </Stack>
    </Container>
  );
}
