import React from 'react';
import {
  Document,
  Page,
  Path,
  Rect,
  StyleSheet,
  Svg,
  Text,
  View,
} from '@react-pdf/renderer';
import type { ReportBreakdownChartPoint, ReportPayload } from '../types';

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 10,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  header: {
    marginBottom: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 10,
    color: '#475569',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  filters: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  filterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  kpiCard: {
    width: '24%',
    minHeight: 52,
    borderWidth: 1,
    borderColor: '#dbeafe',
    borderRadius: 8,
    padding: 8,
    backgroundColor: '#f8fbff',
  },
  kpiLabel: {
    fontSize: 8,
    color: '#475569',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
  },
  kpiDelta: {
    fontSize: 8,
    color: '#64748b',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  cellName: {
    width: '28%',
    paddingRight: 6,
  },
  cellContext: {
    width: '18%',
    paddingRight: 6,
  },
  cellMetric: {
    width: '10%',
    textAlign: 'right',
  },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 28,
    right: 28,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 8,
  },
});

function renderTrendPath(payload: ReportPayload) {
  const width = 730;
  const height = 180;
  const points = payload.series;

  if (points.length === 0) {
    return null;
  }

  const maxSpend = Math.max(...points.map((point) => point.spend), 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const d = points
    .map((point, index) => {
      const x = index * step;
      const y = height - (point.spend / maxSpend) * (height - 20) - 10;
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height + 24}>
      <Rect x={0} y={0} width={width} height={height} fill="#f8fafc" rx={8} />
      <Path d={d} stroke="#2563eb" strokeWidth={3} fill="none" />
      {points.map((point, index) => {
        const x = index * step;
        const y = height - (point.spend / maxSpend) * (height - 20) - 10;

        return (
          <React.Fragment key={point.key}>
            <Rect x={x - 2} y={y - 2} width={4} height={4} fill="#2563eb" />
            <Text
              style={{ position: 'absolute', fontSize: 7, color: '#475569' }}
              x={Math.max(0, x - 12)}
              y={height + 12}
            >
              {point.label}
            </Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function BreakdownBars({ rows }: { rows: ReportBreakdownChartPoint[] }) {
  const width = 730;
  const height = 180;
  const maxSpend = Math.max(...rows.map((row) => row.spend), 1);
  const barWidth = rows.length > 0 ? Math.max(24, Math.floor(width / Math.max(rows.length, 1)) - 12) : 32;

  return (
    <Svg width={width} height={height + 32}>
      <Rect x={0} y={0} width={width} height={height} fill="#f8fafc" rx={8} />
      {rows.map((row, index) => {
        const x = 12 + index * (barWidth + 12);
        const barHeight = (row.spend / maxSpend) * (height - 36);
        const y = height - barHeight - 16;

        return (
          <React.Fragment key={row.id}>
            <Rect x={x} y={y} width={barWidth} height={barHeight} fill="#0ea5e9" rx={4} />
            <Text
              style={{ position: 'absolute', fontSize: 7, color: '#475569' }}
              x={x}
              y={height + 12}
            >
              {row.label.slice(0, 12)}
            </Text>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

export function ReportPdfDocument({ payload }: { payload: ReportPayload }) {
  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{payload.export.title}</Text>
          <Text style={styles.subtitle}>
            {payload.meta.businessName} | {payload.export.subtitle}
          </Text>
          <Text style={styles.subtitle}>
            Generated {new Date(payload.export.generatedAt).toLocaleString('en-US', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </Text>
          <View style={styles.filters}>
            {payload.export.filterSummary.map((item) => (
              <Text key={item.label} style={styles.filterBadge}>
                {item.label}: {item.value}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.kpiGrid}>
          {payload.kpis.map((kpi) => (
            <View key={kpi.key} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>{kpi.formattedValue}</Text>
              <Text style={styles.kpiDelta}>
                {kpi.deltaPercent == null ? 'No comparison' : `${kpi.deltaPercent.toFixed(1)}% vs previous`}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Primary Trend</Text>
          {renderTrendPath(payload) ?? <Text>No time-series data available.</Text>}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{payload.breakdown.title}</Text>
          {payload.breakdown.chart.length > 0 ? (
            <BreakdownBars rows={payload.breakdown.chart} />
          ) : (
            <Text>No breakdown data available.</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Breakdown Table</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.cellName}>Name</Text>
            <Text style={styles.cellContext}>Context</Text>
            <Text style={styles.cellMetric}>Spend</Text>
            <Text style={styles.cellMetric}>Results</Text>
            <Text style={styles.cellMetric}>Impr.</Text>
            <Text style={styles.cellMetric}>Clicks</Text>
            <Text style={styles.cellMetric}>CTR</Text>
          </View>
          {payload.breakdown.rows.slice(0, 12).map((row) => (
            <View key={row.id} style={styles.tableRow}>
              <Text style={styles.cellName}>{row.name}</Text>
              <Text style={styles.cellContext}>{row.primaryContext || row.secondaryContext || '—'}</Text>
              <Text style={styles.cellMetric}>{row.spend.toFixed(2)}</Text>
              <Text style={styles.cellMetric}>{row.conversion.toLocaleString()}</Text>
              <Text style={styles.cellMetric}>{row.impressions.toLocaleString()}</Text>
              <Text style={styles.cellMetric}>{row.clicks.toLocaleString()}</Text>
              <Text style={styles.cellMetric}>{row.ctr.toFixed(2)}%</Text>
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) => `DeepVisor report | Page ${pageNumber} of ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  );
}
