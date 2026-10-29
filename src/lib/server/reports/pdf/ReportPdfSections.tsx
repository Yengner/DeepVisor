import React from 'react';
import { Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { ReportMetricKey, ReportPayload } from '../types';
import { EXPORT_METRICS, type ReportExportRecord } from '@/lib/shared/reports/exportRecords';
import { moneyMetrics } from '@/lib/shared/reports/breakdowns';
export const pdfStyles = StyleSheet.create({
  page: { paddingTop: 90, paddingHorizontal: 30, paddingBottom: 44, fontSize: 8, color: '#102c46', fontFamily: 'Helvetica' },
  header: { position: 'absolute', top: 25, left: 30, right: 30 },
  eyebrow: { fontSize: 8, color: '#535d6b', marginBottom: 5 },
  title: { fontSize: 18, fontWeight: 700, marginBottom: 5 },
  note: { fontSize: 7, color: '#535d6b', lineHeight: 1.45 },
  tableHeader: { flexDirection: 'row', padding: 6, backgroundColor: '#eaf2ff', marginTop: 10 },
  row: { borderBottomWidth: 1, borderBottomColor: '#d8dee6', padding: 7 },
  line: { flexDirection: 'row' },
  label: { width: '31%', paddingRight: 8, fontWeight: 700, lineHeight: 1.4 },
  cell: { flex: 1, paddingLeft: 4, lineHeight: 1.4 },
  detail: { fontSize: 7, color: '#535d6b', marginTop: 4, lineHeight: 1.45 },
  footer: { position: 'absolute', bottom: 20, left: 30, right: 30, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: '#535d6b' },
});
export function exportValueLabel(row: ReportExportRecord, metric: ReportMetricKey): string {
  const value = row.values[metric];
  if (value == null || !Number.isFinite(value)) return 'Unavailable';
  if (row.kind === 'change') return `${value > 0 ? '+' : ''}${value.toFixed(2)}${metric === 'ctr' || metric === 'conversionRate' ? ' pp' : '%'}`;
  if (moneyMetrics.has(metric)) {
    if (!row.currency || row.currency === 'MIXED') return 'Unavailable';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: row.currency }).format(value);
  }
  if (metric === 'ctr' || metric === 'conversionRate') return `${value.toFixed(2)}%`;
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
export function PdfFooter({ payload, demo }: { payload: ReportPayload; demo: boolean }) {
  return <View fixed style={pdfStyles.footer}><Text>{demo ? 'DEMO DATA · ' : ''}{payload.meta.businessName}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>;
}
const metricGroups: ReportMetricKey[][] = [
  ['spend', 'conversion', 'costPerResult', 'impressions', 'clicks'],
  ['linkClicks', 'ctr', 'cpc', 'cpm', 'conversionRate'],
  ['leads', 'messages', 'calls', 'reach', 'frequency'],
];
/** Automatic PDF pagination retains every record; fixed page headers/footers repeat on continuation pages. */
export function ReportPdfSections({ payload, records, demo }: { payload: ReportPayload; records: ReportExportRecord[]; demo: boolean }) {
  const groups = new Map<string, ReportExportRecord[]>();
  for (const row of records) {
    const key = `${row.kind}: ${row.context}`;
    groups.set(key, [...groups.get(key) ?? [], row]);
  }
  return <>{[...groups].flatMap(([title, rows]) => {
    const groupsWithData = metricGroups.filter(metrics => metrics.some(key => rows.some(row => key in row.values)));
    const columns = groupsWithData.length ? groupsWithData : [[]];
    const batches = rows.length <= 4 ? [columns] : columns.map(metrics => [metrics]);
    return batches.map((batch, index) => <Page key={`${title}:${index}`} size="LETTER" style={[pdfStyles.page, ...(rows.length > 4 ? [{ paddingTop: 126 }] : [])]}>
      <View fixed style={pdfStyles.header}><Text style={pdfStyles.eyebrow}>{demo ? 'DEMO DATA · ' : ''}{rows[0].kind.replaceAll('_', ' ').toUpperCase()}</Text><Text style={pdfStyles.title}>{rows[0].context}</Text>
        <Text style={pdfStyles.note}>Report: {payload.query.dateFrom} – {payload.query.dateTo} · {payload.meta.timezone ?? 'Timezone unknown'} · {rows.length} records</Text></View>
      {batch.map((metrics, metricIndex) => <React.Fragment key={metricIndex}>
        <View fixed={rows.length > 4} style={[pdfStyles.tableHeader, ...(rows.length > 4 ? [{ position: 'absolute' as const, top: 80, left: 30, right: 30 }] : [])]} minPresenceAhead={45}><Text style={pdfStyles.label}>Observation / entity</Text>{metrics.map(key => <Text key={key} style={pdfStyles.cell}>{EXPORT_METRICS.find(([metric]) => metric === key)![1]}</Text>)}</View>
        {rows.map((row, rowIndex) => <View key={`${row.id}:${rowIndex}`} style={pdfStyles.row} wrap={false}>
          <View style={pdfStyles.line}><Text style={pdfStyles.label}>{row.label}</Text>{metrics.map(key => <Text key={key} style={pdfStyles.cell}>{exportValueLabel(row, key)}</Text>)}</View>
          <Text style={pdfStyles.detail}>{row.basis} · {row.from && row.to ? `${row.from} – ${row.to}` : 'Measurement window unknown'} · {row.currency ?? 'Currency unknown'}{row.level ? ` · ${row.level}` : ''}{row.status ? ` · recorded status: ${row.status}` : ''}{row.observations != null ? ` · ${row.observations} observations` : ''}</Text>
          {(row.primaryContext || row.secondaryContext) && <Text style={pdfStyles.detail}>{[row.secondaryContext, row.primaryContext].filter(Boolean).join(' / ')}</Text>}
          <Text style={pdfStyles.detail}>{row.coverage}</Text>
          {row.note && <Text style={pdfStyles.detail}>{row.note}</Text>}
        </View>)}
      </React.Fragment>)}
      <PdfFooter payload={payload} demo={demo} />
    </Page>);
  })}</>;
}
