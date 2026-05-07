import {
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconDownload,
  IconFileAnalytics,
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

export default async function ArchivedReportPage({
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

  return (
    <Container size="xl" pb="xl">
      <Stack gap="lg">
        <Card withBorder radius="lg" p="xl" className="app-platform-page-hero">
          <Group justify="space-between" align="flex-start" gap="xl" wrap="wrap">
            <Stack gap="sm" maw={760}>
              <Group gap="xs" wrap="wrap">
                <Badge variant="light" className="app-platform-page-badge">
                  Report archive
                </Badge>
                <Badge color="blue" variant="light">
                  {report.levelLabel}
                </Badge>
                {report.storagePath ? (
                  <Badge color="green" variant="light">
                    Stored PDF
                  </Badge>
                ) : null}
              </Group>

              <div>
                <Text size="sm" fw={600} className="app-platform-page-kicker">
                  {formatReportWindow(report)}
                </Text>
                <Title order={2} mt={4} className="app-platform-page-title">
                  {report.title}
                </Title>
                <Text size="md" maw={680} mt="xs" className="app-platform-page-copy">
                  View the queued report PDF in DeepVisor, then download the stored copy if you
                  need to share or keep it externally.
                </Text>
              </div>

              <Group gap="xs" wrap="wrap">
                {report.adAccountName ? (
                  <Badge color="gray" variant="outline">
                    {report.adAccountName}
                  </Badge>
                ) : null}
                <Badge color="gray" variant="outline">
                  Spend {formatCurrency(report.summary.spend)}
                </Badge>
                <Badge color="gray" variant="outline">
                  Results {formatNumber(report.summary.results)}
                </Badge>
                <Badge color="gray" variant="outline">
                  CTR {formatPercent(report.summary.ctr)}
                </Badge>
              </Group>
            </Stack>

            <Group gap="xs">
              <Button
                component="a"
                href="/settings#report-archive"
                radius="xl"
                variant="default"
                leftSection={<IconArrowLeft size={16} />}
              >
                Archive
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

        {report.pdfHref ? (
          <Card withBorder radius="lg" p="md">
            <iframe
              title={report.title}
              src={report.pdfHref}
              style={{
                width: '100%',
                height: '78vh',
                minHeight: 760,
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
            title="Stored PDF unavailable"
          >
            <Text size="sm">
              This report record exists, but no PDF file is attached to it yet. Run the scheduled
              report queue again to generate and store the PDF.
            </Text>
          </Alert>
        )}

        <Card withBorder radius="lg" p="md">
          <Group gap="sm">
            <IconFileAnalytics size={18} />
            <div>
              <Text fw={700}>Stored report details</Text>
              <Text size="sm" c="dimmed">
                File {report.fileName ?? 'report.pdf'} · Cost/result{' '}
                {formatCurrency(report.summary.costPerResult)} · Clicks{' '}
                {formatNumber(report.summary.clicks)}
              </Text>
            </div>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}
