'use client';
import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { useMemo, useState, useTransition } from 'react';
import { Button, Drawer, Group, Loader, Text } from '@mantine/core';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReportFilterOptions, ReportPayload } from '@/lib/server/reports/types';
import ReportsHeader from './layout/ReportsHeader';
import ReportsSidebar from './layout/ReportsSidebar';
import { buildReportBreadcrumbs, getActiveFilterCount, updateReportParams } from './layout/reportNavigation';
import { ReportSections, useReportSection } from './layout/ReportSections';
import { ReportSectionPanel } from './layout/ReportSectionPanel';
import { reportExportUrl } from '@/lib/shared/reports/exportLinks';
import { ReportMetrics } from './ReportMetrics';
import { ReportDataStatus } from './ReportDataStatus';
import { PerformanceSection } from './sections/PerformanceSection';
import { BreakdownSection } from './sections/BreakdownSection';
import { TimeSection } from './sections/TimeSection';
import { AdvertisingSection } from './sections/AdvertisingSection';
import { FindingsSection } from './sections/FindingsSection';
import classes from './Workspace.module.css';

export function ReportsClient({ payload, filterOptions, isDemo = false }: {
  payload: ReportPayload; filterOptions: ReportFilterOptions; isDemo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filtersOpened, setFiltersOpened] = useState(false);
  const { section, select } = useReportSection();
  const currentSearchString = searchParams?.toString() ?? '';
  const updateSearch = (mutate: (params: URLSearchParams) => void) => {
    const params = updateReportParams(currentSearchString, payload.query, mutate);
    startTransition(() => router.replace(`${pathname}?${params.toString()}#${section}`, { scroll: false }));
  };
  const exportLinks = useMemo(() => reportExportUrl(payload.query, isDemo), [payload.query, isDemo]);
  const breadcrumbs = buildReportBreadcrumbs(payload, filterOptions);
  return <div className={classes.workspace}>
    <Drawer opened={filtersOpened} onClose={() => setFiltersOpened(false)} title="Report filters" position="right" size="md">
      <ReportsSidebar query={payload.query} filterOptions={filterOptions} onUpdate={mutate => { setFiltersOpened(false); updateSearch(mutate); }} />
    </Drawer>
    <ReportsHeader payload={payload} filterOptions={filterOptions} exportLinks={exportLinks} onUpdate={updateSearch}
      onRefresh={() => startTransition(() => router.refresh())} onOpenFilters={() => setFiltersOpened(true)}
      activeFilterCount={getActiveFilterCount(payload)} isDemo={isDemo} isPending={isPending} />
    {breadcrumbs.length > 1 && <nav aria-label="Report scope"><Group gap="xs">
      {breadcrumbs.map((item, index) => item.href ? <Button key={index} component={Link} href={`${item.href}${isDemo ? '&demo=1' : ''}#${section}`} variant="subtle" color="dark" size="compact-sm">{item.label} /</Button> : <Text key={index} size="sm" fw={700}>{item.label}</Text>)}
    </Group></nav>}
    {payload.meta.syncCoverage?.historicalAnalysisPending && <p className={classes.notice}>Historical sync is still expanding saved coverage. Report reload reads saved data.</p>}
    {isPending && <Group role="status"><Loader size="sm" /><Text size="sm">Updating report…</Text></Group>}
    <ReportDataStatus payload={payload} />
    <ReportMetrics payload={payload} />
    <ReportSections section={section} onSelect={select} />
    <div aria-busy={isPending}>
      <div hidden={section !== 'performance'}><PerformanceSection payload={payload} /></div>
      {(['audience', 'geography', 'delivery'] as const).map(name => <ReportSectionPanel key={name} active={section === name}><BreakdownSection payload={payload} section={name} /></ReportSectionPanel>)}
      <ReportSectionPanel active={section === 'time'}><TimeSection payload={payload} /></ReportSectionPanel>
      <ReportSectionPanel active={section === 'advertising'}><AdvertisingSection payload={payload} isDemo={isDemo} /></ReportSectionPanel>
      <ReportSectionPanel active={section === 'findings'}><FindingsSection payload={payload} isDemo={isDemo} /></ReportSectionPanel>

    </div>
  </div>;
}
