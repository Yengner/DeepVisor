import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReportPayload } from '../types';
import { buildReportExportRecords } from '@/lib/shared/reports/exportRecords';
import { formatReportMetric } from '@/lib/shared/reports/metrics';
import { coverageLabel } from '@/lib/shared/reports/coverage';
import { PdfFooter, ReportPdfSections } from './ReportPdfSections';
const styles = StyleSheet.create({
  cover: { padding: 30, paddingBottom: 50, fontFamily: 'Helvetica', color: '#182119', fontSize: 10, backgroundColor: '#fafbf7' },
  eyebrow: { fontSize: 9, color: '#526546', marginBottom: 10, letterSpacing: 1 },
  title: { fontSize: 26, fontWeight: 700, marginBottom: 10 },
  subtitle: { fontSize: 11, color: '#526546', lineHeight: 1.5, marginBottom: 12 },
  filters: { padding: 14, backgroundColor: '#edf3df', borderRadius: 10, marginBottom: 18 },
  filter: { fontSize: 9, lineHeight: 1.5, marginBottom: 3 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16 },
  metric: { width: '50%', padding: 14, borderBottomWidth: 1, borderBottomColor: '#dbe3ce' },
  metricLabel: { fontSize: 9, color: '#526546', marginBottom: 8 },
  metricValue: { fontSize: 21, fontWeight: 700 },
  note: { fontSize: 9, color: '#526546', lineHeight: 1.55, marginBottom: 8 },
});
/** Existing react-pdf document pipeline; content now follows the same contracts as the workspace. */
export function ReportPdfDocument({ payload, demo = false }: { payload: ReportPayload; demo?: boolean }) {
  const records = buildReportExportRecords(payload);
  return <Document title={payload.export.title} author="DeepVisor" subject="Saved reporting measurements">
    <Page size="LETTER" style={styles.cover}>
      <Text style={styles.eyebrow}>{demo ? 'DEMO DATA · ' : ''}DEEPVISOR REPORTS</Text>
      <Text style={styles.title}>{payload.export.title}</Text>
      <Text style={styles.subtitle}>{payload.meta.businessName} · {payload.query.dateFrom} – {payload.query.dateTo}{payload.meta.partialDay ? ' · Partial day' : ''}</Text>
      <Text style={styles.note}>{payload.meta.timezone ?? 'Timezone unknown'} · Currency: {payload.meta.currencyCode ?? 'unknown'} · Generated {payload.meta.generatedAt} (UTC)</Text>
      <View style={styles.filters}>
        <Text style={styles.filter}>Scope: {payload.query.scope} · Range: {payload.query.rangeMode ?? 'date_range'} · Grouping: {payload.query.groupBy} · Compare: {payload.query.compareMode}</Text>
        {payload.export.filterSummary.map((filter, i) => <Text key={`${filter.label}:${i}`} style={styles.filter}>{filter.label}: {filter.value}</Text>)}
      </View>
      <View style={styles.metrics}>{([['spend', 'Spend'], ['conversion', 'Results'], ['costPerResult', 'Cost per result'], ['impressions', 'Impressions']] as const).map(([key, label]) => <View key={key} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{formatReportMetric(payload.summary, key, payload.meta.currencyCode)}</Text></View>)}</View>
      <Text style={styles.note}>Performance coverage: {coverageLabel(payload.meta.coverage)}.</Text>
      {payload.comparison.disabledReason && <Text style={styles.note}>{payload.comparison.disabledReason}</Text>}
      {payload.meta.warnings?.map(warning => <Text key={warning} style={styles.note}>{warning}</Text>)}
      <Text style={styles.note}>This export includes all report sections for the selected scope, independent of local chart selections. Snapshot windows are separate from the reporting period. Different dimensions and account-context views must not be added together.</Text>
      <Text style={styles.note}>Unavailable means missing, unsupported or incompatible measurements; it does not mean zero. Ratios use aggregate inputs. Unique reach/frequency are unavailable without verified period-unique reach. Previous-period CTR changes use percentage points (pp).</Text>
      <Text style={styles.note}>Saved findings are historical observations, not a new evaluation. Recorded entity status is separate from selected-period performance. Reloading or exporting a report does not synchronize Meta.</Text>
      <PdfFooter payload={payload} demo={demo} />
    </Page>
    <ReportPdfSections payload={payload} records={records} demo={demo} />
  </Document>;
}
