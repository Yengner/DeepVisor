import React from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { deepVisorTheme } from '../../src/theme';
import { ReportsClient } from '../../src/app/(root)/reports/components/ReportsClient';
import { buildReportFixture, type ReportFixtureScenario } from '../../src/lib/shared/reports/fixtures';
import { getDemoReportFilterOptions } from '../../src/lib/server/reports/demo';

// An isolated browser entry, never a production route or a live-data fallback.
const scenario = new URLSearchParams(location.search).get('scenario') ?? 'healthy';
const payload = buildReportFixture(scenario === 'unknown-timezone' ? 'healthy' : scenario as ReportFixtureScenario);
if (scenario === 'unknown-timezone') payload.meta.timezone = null;
createRoot(document.getElementById('root')!).render(
  <MantineProvider theme={deepVisorTheme}><main><ReportsClient payload={payload} filterOptions={getDemoReportFilterOptions()} isDemo /></main></MantineProvider>,
);
