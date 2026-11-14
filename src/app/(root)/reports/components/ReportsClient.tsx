'use client';
import '@mantine/charts/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import { Fragment, useMemo, useState, useTransition } from 'react';
import { Drawer, Loader } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReportFilterOptions, ReportPayload } from '@/lib/server/reports/types';
import type { PerformanceMetric } from '@/lib/shared/reports/performance';
import ReportsHeader from './layout/ReportsHeader';
import ReportsSidebar from './layout/ReportsSidebar';
import { buildReportBreadcrumbs, getActiveFilterCount, updateReportParams } from './layout/reportNavigation';
import { ReportSections, useReportSection } from './layout/ReportSections';
import { ReportSectionPanel } from './layout/ReportSectionPanel';
import { reportExportUrl } from '@/lib/shared/reports/exportLinks';
import { ReportMetrics } from './ReportMetrics';
import { ReportDataStatus } from './ReportDataStatus';
import { PerformanceSection } from './sections/PerformanceSection';
import { OverviewHighlights } from './sections/OverviewHighlights';
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
  // Shared by the KPI cards and the trend chart so either can choose what is charted.
  const [chartMetric, setChartMetric] = useState<PerformanceMetric>('spend');
  const { section, select } = useReportSection();
  const currentSearchString = searchParams?.toString() ?? '';
  const updateSearch = (mutate: (params: URLSearchParams) => void) => {
    const params = updateReportParams(currentSearchString, payload.query, mutate);
    startTransition(() => router.replace(`${pathname}?${params.toString()}#${section}`, { scroll: false }));
  };
  const exportLinks = useMemo(() => reportExportUrl(payload.query, isDemo), [payload.query, isDemo]);
  const breadcrumbs = buildReportBreadcrumbs(payload, filterOptions);
  // The platform crumb repeats the app's account switcher; the trail only helps once the
  // report is narrowed below the ad account.
  const trail = breadcrumbs.filter((_, index) => index > 0 || breadcrumbs.length === 1);
  const scopeName = breadcrumbs.at(-1)?.label ?? payload.meta.scopeLabel;
  const showChart = (metric: PerformanceMetric) => {
    setChartMetric(metric);
    if (section !== 'performance') select('performance');
  };

  return <div className={classes.workspace}>
    <Drawer opened={filtersOpened} onClose={() => setFiltersOpened(false)} title="Report filters" position="right" size="md">
      <ReportsSidebar query={payload.query} filterOptions={filterOptions} onUpdate={mutate => { setFiltersOpened(false); updateSearch(mutate); }} />
    </Drawer>
    <ReportsHeader payload={payload} filterOptions={filterOptions} exportLinks={exportLinks} onUpdate={updateSearch}
      onRefresh={() => startTransition(() => router.refresh())} onOpenFilters={() => setFiltersOpened(true)}
      activeFilterCount={getActiveFilterCount(payload)} scopeName={scopeName} isDemo={isDemo} isPending={isPending} />
    {trail.length > 1 && <nav aria-label="Report scope" className={classes.scope}>
      {trail.map((item, index) => <Fragment key={index}>
        {index > 0 && <IconChevronRight size={14} aria-hidden="true" />}
        {item.href ? <Link href={`${item.href}${isDemo ? '&demo=1' : ''}#${section}`}>{item.label}</Link>
          : <span aria-current="page">{item.label}</span>}
      </Fragment>)}
    </nav>}
    {payload.meta.syncCoverage?.historicalAnalysisPending && <div className={classes.banner}><p>Historical sync is still adding older data. Reloading the report reads what has been saved so far.</p></div>}
    {isPending && <div className={classes.pending} role="status"><Loader size="xs" /> Updating report…</div>}
    <ReportDataStatus payload={payload} />
    <ReportMetrics payload={payload} chartMetric={chartMetric} onChartMetric={showChart} />
    <ReportSections section={section} onSelect={select} />
    <div aria-busy={isPending} style={{ display: 'grid', gap: 16, opacity: isPending ? 0.6 : 1, transition: 'opacity 150ms ease' }}>
      <div hidden={section !== 'performance'} style={{ display: section === 'performance' ? 'grid' : undefined, gap: 16 }}>
        <PerformanceSection payload={payload} metric={chartMetric} onMetric={setChartMetric} />
        <OverviewHighlights payload={payload} onOpen={select} />
      </div>
      {(['audience', 'geography', 'delivery'] as const).map(name => <ReportSectionPanel key={name} active={section === name}><BreakdownSection payload={payload} section={name} /></ReportSectionPanel>)}
      <ReportSectionPanel active={section === 'time'}><TimeSection payload={payload} /></ReportSectionPanel>
      <ReportSectionPanel active={section === 'advertising'}><AdvertisingSection payload={payload} isDemo={isDemo} /></ReportSectionPanel>
      <ReportSectionPanel active={section === 'findings'}><FindingsSection payload={payload} isDemo={isDemo} /></ReportSectionPanel>
    </div>
  </div>;
}
